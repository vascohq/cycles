import type { PitchUpdate, NeedleSnapshot } from '@/cycle-liveblocks.config'
import {
  diffHillTrail,
  rollupHillTrails,
  type ScopeTrail,
  type HillTrailRollup,
} from '@/lib/hill-trail-engine'

export type TimelineCard = {
  id: string
  authorName: string
  authorInitials: string
  postedAt: string
  formattedTimestamp: string
  narrative: string
  needleSnapshot: NeedleSnapshot
  scopesMoved: number
  slackFailed: boolean
  /**
   * Frozen per-scope hill movement between this update's snapshot and the
   * previous update's snapshot. Computed once from STORED snapshots via the
   * shared Hill Trail engine — never recomputed against live positions.
   */
  trails: ScopeTrail[]
  rollup: HillTrailRollup
  /** scopeId -> display title, from the snapshots backing this card's diff. */
  scopeTitles: Record<string, string>
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
    // `sorted` is newest-first, so the immediate predecessor is the next entry.
    const prev = sorted[i + 1]

    // Frozen diff: this update's stored snapshot vs the previous update's
    // stored snapshot. For the first-ever update (no predecessor) we pass an
    // empty previous, which the engine renders as all-"new". Reusing the shared
    // engine over STORED snapshots keeps card movement frozen — it never
    // recomputes against live positions.
    const trails = diffHillTrail(
      prev?.hill_snapshot ?? [],
      update.hill_snapshot.map((s) => ({
        id: s.scopeId,
        hill_progress: s.hill_progress,
      }))
    )
    const rollup = rollupHillTrails(trails)

    // Titles for display, drawn from whichever snapshot holds the scope.
    const scopeTitles: Record<string, string> = {}
    for (const snap of [...(prev?.hill_snapshot ?? []), ...update.hill_snapshot]) {
      if (snap.title) scopeTitles[snap.scopeId] = snap.title
    }

    return {
      id: update.id,
      authorName: user?.name ?? 'Unknown',
      authorInitials: user?.initials ?? '?',
      postedAt: update.posted_at,
      formattedTimestamp: formatUpdateTimestamp(update.posted_at),
      narrative: update.narrative,
      needleSnapshot: update.needle_snapshot,
      scopesMoved: rollup.moved,
      slackFailed: !!update.slack_attempted && !update.slack_delivered_at,
      trails,
      rollup,
      scopeTitles,
    }
  })
}
