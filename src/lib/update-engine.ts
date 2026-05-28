import { nanoid } from 'nanoid'
import type {
  Zone,
  Needle,
  PitchUpdate,
  HillSnapshot,
} from '@/cycle-liveblocks.config'
import { snapForZone } from './needle-engine'

const MS_PER_DAY = 86_400_000

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / MS_PER_DAY
  )
}

export function weekOfTimebox(start: string, end: string, today: string): number {
  const elapsed = daysBetween(start, today)
  return Math.min(Math.floor(elapsed / 7) + 1, Math.ceil(daysBetween(start, end) / 7))
}

export function isTuesday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00').getDay() === 2
}

type BuildUpdateParams = {
  pitchId: string
  userId: string
  zone: Zone
  narrative: string
  currentNeedle: Needle | null
  scopes: { id: string; hill_progress: number }[]
  tasks: { scopeId: string; done: boolean }[]
}

export function buildUpdate(params: BuildUpdateParams): PitchUpdate {
  const { pitchId, userId, zone, narrative, scopes, tasks } = params

  const hill_snapshot: HillSnapshot[] = scopes.map((s) => ({
    scopeId: s.id,
    hill_progress: s.hill_progress,
  }))

  const scopeIds = [...new Set(tasks.map((t) => t.scopeId))]
  const task_snapshot = scopeIds.map((scopeId) => {
    const scopeTasks = tasks.filter((t) => t.scopeId === scopeId)
    return {
      scopeId,
      done: scopeTasks.filter((t) => t.done).length,
      total: scopeTasks.length,
    }
  })

  return {
    id: nanoid(),
    pitchId,
    posted_at: new Date().toISOString(),
    posted_by: userId,
    narrative,
    needle_snapshot: { progress: snapForZone(zone), zone },
    hill_snapshot,
    task_snapshot,
  }
}
