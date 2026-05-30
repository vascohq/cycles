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
