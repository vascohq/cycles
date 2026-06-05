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
import { resolveScopeColors } from '@/lib/color-engine'

export type ScopeGridDerived = {
  id: string
  order: number
  title: string
  tier: CycleScope['tier']
  litmus_text: string
  /** Resolved identity color (stored, or deterministically assigned). */
  color: string
  /** True for the one scope flagged as the pitch's Core Scope (see ADR 0012). */
  isCore: boolean
  tasks: ScopeCardTask[]
}

// Resolve a pitch's core-scope pointer to a live scope id, or null. A pointer
// to a scope that no longer exists (deleted since it was flagged) resolves to
// null — the "dangling pointer is no core set" rule (see ADR 0012), so callers
// self-heal to the empty state rather than rendering a star for a ghost.
export function resolveCoreScopeId(
  coreScopeId: string | undefined,
  scopes: { id: string }[]
): string | null {
  if (!coreScopeId) return null
  return scopes.some((s) => s.id === coreScopeId) ? coreScopeId : null
}

// Whether to show the empty-state prompt nudging the team to pick a Core Scope.
// Driven by the already-resolved `isCore` flags (not the raw pitch pointer), so a
// dangling pointer — resolved to no core upstream — correctly still prompts, and
// the rule reads identically in the live app and the e2e harness. Prompt only
// when there is something to choose from (at least one scope) and nothing chosen.
export function shouldShowCoreScopePrompt(
  items: { isCore: boolean }[]
): boolean {
  return items.length > 0 && !items.some((i) => i.isCore)
}

export function deriveScopeGridItems(
  scopes: CycleScope[],
  tasks: ScopeTask[],
  pitchId: string,
  coreScopeId?: string
): ScopeGridDerived[] {
  const pitchScopes = scopes.filter((s) => s.pitchId === pitchId)
  const colors = resolveScopeColors(pitchScopes)
  const coreId = resolveCoreScopeId(coreScopeId, pitchScopes)
  return pitchScopes.map((s, i) => ({
    id: s.id,
    order: i + 1,
    title: s.title,
    tier: s.tier,
    litmus_text: s.litmus_text,
    color: colors[s.id],
    isCore: s.id === coreId,
    tasks: tasks
      .filter((t) => t.scopeId === s.id)
      .map((t) => ({ id: t.id, title: t.title, done: t.done })),
  }))
}

export function deriveHillScopes(
  scopes: CycleScope[],
  pitchId: string,
  coreScopeId?: string
): HillScope[] {
  const pitchScopes = scopes.filter((s) => s.pitchId === pitchId)
  const colors = resolveScopeColors(pitchScopes)
  const coreId = resolveCoreScopeId(coreScopeId, pitchScopes)
  return pitchScopes.map((s, i) => ({
    id: s.id,
    title: s.title,
    tier: s.tier,
    hill_progress: s.hill_progress,
    order: i + 1,
    color: colors[s.id],
    isCore: s.id === coreId,
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
  // Historical dots reuse the live scope's color by id; snapshots predate the
  // color field, so a scope dropped since the snapshot falls back to neutral.
  const liveColorById = new Map(liveScopes.map((s) => [s.id, s.color]))
  const NEUTRAL = '#9ca3af'
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
      color: liveColorById.get(s.scopeId) ?? NEUTRAL,
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
