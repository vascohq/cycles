import { z } from 'zod'
import type { Zone } from '@/cycle-liveblocks.config'

export const slackMessageSchema = z.object({
  pitchTitle: z.string(),
  weekNumber: z.number(),
  totalWeeks: z.number(),
  zone: z.enum(['on_track', 'some_risk', 'concerned']),
  narrative: z.string(),
  tasksDone: z.number(),
  tasksTotal: z.number(),
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

function formatSlackDate(iso: string): string {
  const epoch = Math.floor(new Date(iso).getTime() / 1000)
  return `<!date^${epoch}^{date_short_pretty} at {time}|${iso}>`
}

export function formatSlackMessage(params: SlackMessageParams): { text: string } {
  const {
    pitchTitle,
    weekNumber,
    totalWeeks,
    zone,
    narrative,
    tasksDone,
    tasksTotal,
    daysLeft,
    pitchUrl,
    postedAt,
  } = params

  const date = formatSlackDate(postedAt)
  const emoji = ZONE_EMOJI[zone]
  const label = ZONE_LABEL[zone]

  const text = [
    `📌 *${pitchTitle}* · Week ${weekNumber} of ${totalWeeks} · ${date}`,
    `${emoji} ${label}`,
    '',
    narrative,
    '',
    `${tasksDone}/${tasksTotal} tasks done · ${daysLeft} days left · <${pitchUrl}|View pitch →>`,
  ].join('\n')

  return { text }
}
