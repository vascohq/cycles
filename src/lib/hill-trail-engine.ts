import type { HillSnapshot, Tier } from '@/cycle-liveblocks.config'

export type TrailLabel =
  | "Didn't move"
  | 'Nudged forward'
  | 'Lots of progress'
  | 'Over the hill'
  | 'Slid back'
  | 'New'
  | 'Dropped'

export type ScopeTrail =
  | {
      scopeId: string
      state: 'moved' | 'stagnant'
      fromProgress: number
      toProgress: number
      stepDelta: number
      label: TrailLabel
    }
  | {
      scopeId: string
      state: 'new'
      toProgress: number
      label: TrailLabel
    }
  | {
      scopeId: string
      state: 'dropped'
      fromProgress: number
      title?: string
      tier?: Tier
      label: TrailLabel
    }

export type HillTrailRollup = {
  moved: number
  stalled: number
  new: number
  dropped: number
}

type TrailScope = { id: string; hill_progress: number }

export const HILL_STEP_COUNT = 14
const CREST_STEP = HILL_STEP_COUNT / 2

export function hillStepIndex(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round(clamped * HILL_STEP_COUNT)
}

// Label describes the delta — it never renders a verdict (no auto "at risk").
function movedLabel(
  fromProgress: number,
  toProgress: number,
  stepDelta: number
): TrailLabel {
  if (stepDelta < 0) return 'Slid back'
  const crossedCrest =
    hillStepIndex(fromProgress) < CREST_STEP &&
    hillStepIndex(toProgress) >= CREST_STEP
  if (crossedCrest) return 'Over the hill'
  return stepDelta >= 3 ? 'Lots of progress' : 'Nudged forward'
}

export function rollupHillTrails(trails: ScopeTrail[]): HillTrailRollup {
  return {
    moved: trails.filter((t) => t.state === 'moved').length,
    stalled: trails.filter((t) => t.state === 'stagnant').length,
    new: trails.filter((t) => t.state === 'new').length,
    dropped: trails.filter((t) => t.state === 'dropped').length,
  }
}

// How many consecutive past updates each live scope has held its current hill
// step. Walks snapshots newest→oldest, counting matches until the step changes
// or the scope is absent. 0 means it moved since the last update. The number is
// reported as a neutral fact — long streaks signal "quiet", never a verdict.
export function noChangeStreaks(
  snapshotsNewestFirst: HillSnapshot[][],
  liveScopes: TrailScope[]
): Map<string, number> {
  const streaks = new Map<string, number>()
  for (const scope of liveScopes) {
    const liveStep = hillStepIndex(scope.hill_progress)
    let streak = 0
    for (const snapshot of snapshotsNewestFirst) {
      const prev = snapshot.find((s) => s.scopeId === scope.id)
      if (!prev || hillStepIndex(prev.hill_progress) !== liveStep) break
      streak++
    }
    streaks.set(scope.id, streak)
  }
  return streaks
}

// Notable trail labels get named in the movement line; routine forward moves
// are collapsed into a count, and quiet scopes are listed separately.
const NOTABLE_PHRASE: Partial<Record<TrailLabel, string>> = {
  'Over the hill': 'over the hill',
  'Slid back': 'slid back',
  New: 'added',
  Dropped: 'dropped',
}

const NAMED_CAP = 3

function trailTitle(trail: ScopeTrail, titles: Map<string, string>): string {
  const fromMap = titles.get(trail.scopeId)
  if (fromMap) return fromMap
  if ('title' in trail && trail.title) return trail.title
  return trail.scopeId
}

// Builds the human movement line from trails + streaks + scope titles. Names
// notable events (capped, overflow → "+N more"), always lists quiet scopes with
// their no-change count (longest streak first), and collapses routine forward
// moves into a count. Returns null when there are no scopes to report on.
export function summarizeMovement(
  trails: ScopeTrail[],
  streaks: Map<string, number>,
  titles: Map<string, string>
): string | null {
  if (trails.length === 0) return null

  const notable = trails
    .filter((t) => NOTABLE_PHRASE[t.label])
    .map((t) => `${trailTitle(t, titles)} ${NOTABLE_PHRASE[t.label]}`)
  const notableSegments =
    notable.length > NAMED_CAP
      ? [...notable.slice(0, NAMED_CAP), `+${notable.length - NAMED_CAP} more`]
      : notable

  const quietSegments = trails
    .filter((t) => t.state === 'stagnant')
    .map((t) => ({ name: trailTitle(t, titles), streak: streaks.get(t.scopeId) ?? 1 }))
    .sort((a, b) => b.streak - a.streak)
    .map(({ name, streak }) =>
      streak >= 2 ? `${name} no change for ${streak} updates` : `${name} no change`
    )

  const nudged = trails.filter(
    (t) => t.label === 'Nudged forward' || t.label === 'Lots of progress'
  ).length
  const routineSegment = nudged > 0 ? [`+${nudged} nudged forward`] : []

  const segments = [...notableSegments, ...quietSegments, ...routineSegment]
  return segments.length > 0 ? segments.join(' · ') : null
}

export function diffHillTrail(
  previous: HillSnapshot[],
  current: TrailScope[]
): ScopeTrail[] {
  const trails: ScopeTrail[] = []
  for (const scope of current) {
    const prev = previous.find((p) => p.scopeId === scope.id)
    if (!prev) {
      trails.push({
        scopeId: scope.id,
        state: 'new',
        toProgress: scope.hill_progress,
        label: 'New',
      })
      continue
    }
    const stepDelta =
      hillStepIndex(scope.hill_progress) - hillStepIndex(prev.hill_progress)
    trails.push({
      scopeId: scope.id,
      state: stepDelta === 0 ? 'stagnant' : 'moved',
      fromProgress: prev.hill_progress,
      toProgress: scope.hill_progress,
      stepDelta,
      label:
        stepDelta === 0
          ? "Didn't move"
          : movedLabel(prev.hill_progress, scope.hill_progress, stepDelta),
    })
  }
  for (const prev of previous) {
    if (current.some((s) => s.id === prev.scopeId)) continue
    trails.push({
      scopeId: prev.scopeId,
      state: 'dropped',
      fromProgress: prev.hill_progress,
      ...(prev.title !== undefined ? { title: prev.title } : {}),
      ...(prev.tier !== undefined ? { tier: prev.tier } : {}),
      label: 'Dropped',
    })
  }
  return trails
}
