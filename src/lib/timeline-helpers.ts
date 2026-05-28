import type { PitchUpdate, NeedleSnapshot } from '@/cycle-liveblocks.config'

export type TimelineCard = {
  id: string
  authorName: string
  authorInitials: string
  postedAt: string
  formattedTimestamp: string
  narrative: string
  needleSnapshot: NeedleSnapshot
  scopesMoved: number
}

export function formatUpdateTimestamp(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const date = d.getUTCDate()
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  const mm = minutes.toString().padStart(2, '0')
  return `${day} ${month} ${date} · ${h12}:${mm} ${ampm}`
}

export function deriveTimelineCards(
  updates: PitchUpdate[],
  users: Map<string, { name: string; initials: string }>
): TimelineCard[] {
  const sorted = [...updates].sort(
    (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
  )

  return sorted.map((update, i) => {
    const user = users.get(update.posted_by)
    const prev = sorted[i + 1]

    let scopesMoved = 0
    if (prev) {
      const prevMap = new Map(
        prev.hill_snapshot.map((h) => [h.scopeId, h.hill_progress])
      )
      scopesMoved = update.hill_snapshot.filter((h) => {
        const prevProgress = prevMap.get(h.scopeId)
        return prevProgress !== undefined && h.hill_progress !== prevProgress
      }).length
    }

    return {
      id: update.id,
      authorName: user?.name ?? 'Unknown',
      authorInitials: user?.initials ?? '?',
      postedAt: update.posted_at,
      formattedTimestamp: formatUpdateTimestamp(update.posted_at),
      narrative: update.narrative,
      needleSnapshot: update.needle_snapshot,
      scopesMoved,
    }
  })
}
