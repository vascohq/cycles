import { z } from 'zod'

const zoneEnum = z.enum(['on_track', 'some_risk', 'concerned'])

export const slackMessageSchema = z.object({
  pitchTitle: z.string(),
  /** The pitch's identity emoji; leads the message in place of 📌 when set. */
  pitchEmoji: z.string().default(''),
  weekNumber: z.number(),
  totalWeeks: z.number(),
  zone: zoneEnum,
  previousZone: zoneEnum.nullable(),
  authorName: z.string(),
  narrative: z.string(),
  movement: z.string().nullable(),
  needleProgress: z.number(),
  previousNeedleProgress: z.number().nullable(),
  daysLeft: z.number(),
  pitchUrl: z
    .string()
    .url()
    .refine(
      (u) => u.startsWith('https://') || u.startsWith('http://localhost'),
      'Must be HTTPS'
    ),
  postedAt: z.string(),
})

export type SlackMessageParams = z.infer<typeof slackMessageSchema>

// Minimal Block Kit shapes — Slack accepts plain JSON; we only model what we emit.
type TextObject = { type: 'plain_text' | 'mrkdwn'; text: string; emoji?: boolean }
export type SlackBlock =
  | { type: 'header'; text: TextObject }
  | { type: 'section'; text: TextObject }
  | { type: 'context'; elements: TextObject[] }

type Zone = SlackMessageParams['zone']

const ZONE_EMOJI: Record<Zone, string> = {
  on_track: '🟢',
  some_risk: '🟡',
  concerned: '🔴',
}

const ZONE_LABEL: Record<Zone, string> = {
  on_track: 'On track',
  some_risk: 'Some risk',
  concerned: 'Concerned',
}

// Neutral by design: a worsening and an improving transition render identically
// — we show the movement, we don't judge its direction.
function zoneLine(zone: Zone, previousZone: Zone | null): string {
  if (previousZone === null || previousZone === zone) {
    return `${ZONE_EMOJI[zone]}  *${ZONE_LABEL[zone]}*`
  }
  return `${ZONE_EMOJI[previousZone]} → ${ZONE_EMOJI[zone]}  *Now ${ZONE_LABEL[zone].toLowerCase()}*  (was ${ZONE_LABEL[previousZone].toLowerCase()})`
}

function formatSlackDate(iso: string): string {
  const epoch = Math.floor(new Date(iso).getTime() / 1000)
  return `<!date^${epoch}^{date_short_pretty} at {time}|${iso}>`
}

// The needle is "how far along". Celebrate only when it reaches 100% (done);
// surface a regression honestly; otherwise stay silent (ordinary forward
// progress needs no line). Shared by Slack and the preview so they can't drift.
export function needleProgressNote(
  previousProgress: number | null,
  progress: number
): string | null {
  const to = Math.round(progress * 100)
  const from = previousProgress === null ? null : Math.round(previousProgress * 100)
  // Reached the finish line this update.
  if (to >= 100 && (from === null || from < 100)) return '🎉 Needle at 100% — done!'
  if (from === null || to === from) return null
  if (to < from) return `🔻 Needle slipped back ${from - to}% (${from}% → ${to}%)`
  return null
}

export function formatSlackMessage(params: SlackMessageParams): {
  blocks: SlackBlock[]
  text: string
} {
  const {
    pitchTitle,
    pitchEmoji,
    zone,
    previousZone,
    narrative,
    movement,
    needleProgress,
    previousNeedleProgress,
    authorName,
    weekNumber,
    totalWeeks,
    daysLeft,
    pitchUrl,
    postedAt,
  } = params

  // The pitch's identity emoji leads the message; fall back to the pin.
  const lead = pitchEmoji || '📌'

  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: `${lead} ${pitchTitle}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: zoneLine(zone, previousZone) } },
  ]

  const celebration = needleProgressNote(previousNeedleProgress, needleProgress)
  if (celebration) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: celebration } })
  }

  // Narrative is optional — only render the blockquote when there's something.
  const trimmed = narrative.trim()
  if (trimmed) {
    const quoted = trimmed
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: quoted } })
  }

  if (movement) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: movement }] })
  }

  const footer = `${authorName} · Week ${weekNumber} of ${totalWeeks} · ${daysLeft} days left · ${formatSlackDate(postedAt)} · <${pitchUrl}|View pitch →>`
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: footer }] })

  // Notification fallback (shown in push/preview, where blocks don't render).
  const text = trimmed
    ? `${lead} ${pitchTitle} · ${ZONE_LABEL[zone]}\n${trimmed}`
    : `${lead} ${pitchTitle} · ${ZONE_LABEL[zone]}`

  return { blocks, text }
}
