import type {
  CycleScope,
  ScopeTask,
  ParkingItem,
  PitchUpdate,
} from '@/cycle-liveblocks.config'
import type { HillScope } from '@/components/hill-chart/hill-chart'
import type { ScopeCardTask } from '@/components/scope-card/scope-card'
import type { ParkingLotItem } from '@/components/parking-lot/parking-lot'
import { diffHillTrail, type ScopeTrail } from '@/lib/hill-trail-engine'

export type ScopeGridDerived = {
  id: string
  order: number
  title: string
  tier: CycleScope['tier']
  litmus_text: string
  tasks: ScopeCardTask[]
}

export function deriveScopeGridItems(
  scopes: CycleScope[],
  tasks: ScopeTask[],
  pitchId: string
): ScopeGridDerived[] {
  return scopes
    .filter((s) => s.pitchId === pitchId)
    .map((s, i) => ({
      id: s.id,
      order: i + 1,
      title: s.title,
      tier: s.tier,
      litmus_text: s.litmus_text,
      tasks: tasks
        .filter((t) => t.scopeId === s.id)
        .map((t) => ({ id: t.id, title: t.title, done: t.done })),
    }))
}

export function deriveHillScopes(
  scopes: CycleScope[],
  pitchId: string
): HillScope[] {
  return scopes
    .filter((s) => s.pitchId === pitchId)
    .map((s, i) => ({
      id: s.id,
      title: s.title,
      tier: s.tier,
      hill_progress: s.hill_progress,
      order: i + 1,
    }))
}

export function deriveParkingLotItems(
  items: ParkingItem[],
  pitchId: string
): ParkingLotItem[] {
  return items
    .filter((item) => item.pitchId === pitchId)
    .map((item) => ({
      id: item.id,
      text: item.text,
      resolved: item.resolved,
    }))
}

// A single Hill History frame: the dots and trail to show for one posted
// update, plus a label describing which update it is.
export type HillHistoryFrame = {
  updateId: string
  scopes: HillScope[]
  trails: ScopeTrail[]
  postedAt: string
  authorName: string
}

const DEFAULT_TIER: CycleScope['tier'] = 'should'

// Build the historical frames for the Hill History scrubber, newest first.
// Each frame shows that update's snapshot positions, with the trail computed by
// the shared engine against the prior update's snapshot (snapshot-vs-snapshot).
// `order` for each dot is taken from the live scope (by id) when it still
// exists, so dot numbers stay consistent with the live frame; otherwise it
// falls back to the snapshot index.
export function buildHillHistoryFrames(
  updates: PitchUpdate[],
  liveScopes: HillScope[],
  users: Map<string, { name: string }>
): HillHistoryFrame[] {
  const liveOrderById = new Map(liveScopes.map((s) => [s.id, s.order]))
  // Oldest → newest so each update can diff against its immediate predecessor.
  const chronological = [...updates].sort(
    (a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()
  )

  const frames = chronological.map((update, i) => {
    const prev = chronological[i - 1]
    const scopes: HillScope[] = update.hill_snapshot.map((s, idx) => ({
      id: s.scopeId,
      title: s.title ?? '',
      tier: s.tier ?? DEFAULT_TIER,
      hill_progress: s.hill_progress,
      order: liveOrderById.get(s.scopeId) ?? idx + 1,
    }))
    const trails = diffHillTrail(
      prev ? prev.hill_snapshot : [],
      update.hill_snapshot.map((s) => ({
        id: s.scopeId,
        hill_progress: s.hill_progress,
      }))
    )
    return {
      updateId: update.id,
      scopes,
      trails,
      postedAt: update.posted_at,
      authorName: users.get(update.posted_by)?.name ?? 'Unknown',
    }
  })

  // Present newest first: prev/next arrows step newest → oldest.
  return frames.reverse()
}

export function deriveTotalTaskProgress(
  scopes: CycleScope[],
  tasks: ScopeTask[],
  pitchId: string
): { done: number; total: number } {
  const pitchScopeIds = new Set(
    scopes.filter((s) => s.pitchId === pitchId).map((s) => s.id)
  )
  const pitchTasks = tasks.filter((t) => pitchScopeIds.has(t.scopeId))
  return {
    done: pitchTasks.filter((t) => t.done).length,
    total: pitchTasks.length,
  }
}
