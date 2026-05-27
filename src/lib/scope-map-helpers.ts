import type { CycleScope, ScopeTask, ParkingItem } from '@/cycle-liveblocks.config'
import type { HillScope } from '@/components/hill-chart/hill-chart'
import type { ScopeCardTask } from '@/components/scope-card/scope-card'
import type { ParkingLotItem } from '@/components/parking-lot/parking-lot'

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
