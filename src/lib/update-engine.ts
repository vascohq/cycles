import { nanoid } from 'nanoid'
import type {
  Zone,
  Needle,
  Tier,
  PitchUpdate,
  HillSnapshot,
} from '@/cycle-liveblocks.config'
import { snapForZone } from './needle-engine'

type BuildUpdateParams = {
  pitchId: string
  userId: string
  zone: Zone
  narrative: string
  currentNeedle: Needle | null
  scopes: { id: string; hill_progress: number; title?: string; tier?: Tier }[]
  tasks: { scopeId: string; done: boolean }[]
  timebox: { daysLeft: number; currentWeek: number; totalWeeks: number }
}

export function buildUpdate(params: BuildUpdateParams): PitchUpdate {
  const { pitchId, userId, zone, narrative, scopes, tasks, timebox } = params

  const hill_snapshot: HillSnapshot[] = scopes.map((s) => ({
    scopeId: s.id,
    hill_progress: s.hill_progress,
    ...(s.title !== undefined ? { title: s.title } : {}),
    ...(s.tier !== undefined ? { tier: s.tier } : {}),
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
    timebox_snapshot: timebox,
  }
}
