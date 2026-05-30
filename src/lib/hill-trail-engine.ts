import type { HillSnapshot, Tier } from '@/cycle-liveblocks.config'

export type ScopeTrail =
  | {
      scopeId: string
      state: 'moved' | 'stagnant'
      fromProgress: number
      toProgress: number
      stepDelta: number
    }
  | {
      scopeId: string
      state: 'new'
      toProgress: number
    }
  | {
      scopeId: string
      state: 'dropped'
      fromProgress: number
      title?: string
      tier?: Tier
    }

type TrailScope = { id: string; hill_progress: number }

export const HILL_STEP_COUNT = 14

export function hillStepIndex(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round(clamped * HILL_STEP_COUNT)
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
    })
  }
  return trails
}
