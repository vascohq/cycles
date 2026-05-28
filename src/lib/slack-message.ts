import type { Zone } from '@/cycle-liveblocks.config'

export type SlackMessageParams = {
  pitchTitle: string
  weekNumber: number
  totalWeeks: number
  zone: Zone
  narrative: string
  tasksDone: number
  tasksTotal: number
  daysLeft: number
  pitchUrl: string
  postedAt: string
}

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

function formatTime(iso: string): string {
  const d = new Date(iso)
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  const mm = minutes.toString().padStart(2, '0')
  return `${h12}:${mm} ${ampm}`
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

  const time = formatTime(postedAt)
  const emoji = ZONE_EMOJI[zone]
  const label = ZONE_LABEL[zone]

  const text = [
    `📌 *${pitchTitle}* · Week ${weekNumber} of ${totalWeeks} · ${time}`,
    `${emoji} ${label}`,
    '',
    narrative,
    '',
    `${tasksDone}/${tasksTotal} tasks done · ${daysLeft} days left · <${pitchUrl}|View pitch →>`,
  ].join('\n')

  return { text }
}
