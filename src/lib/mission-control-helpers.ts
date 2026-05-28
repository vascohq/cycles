import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  PitchUpdate,
  Needle,
  Stage,
} from '@/cycle-liveblocks.config'

export type PitchCard = {
  id: string
  title: string
  stage: Stage
  needle: Needle | null
  tasksDone: number
  tasksTotal: number
  lastUpdatedAt: string | null
  timebox_start: string
  timebox_end: string
}

export function derivePitchCards(
  pitches: CyclePitch[],
  scopes: CycleScope[],
  tasks: ScopeTask[],
  updates: PitchUpdate[]
): PitchCard[] {
  return pitches.map((p) => {
    const pitchScopeIds = new Set(
      scopes.filter((s) => s.pitchId === p.id).map((s) => s.id)
    )
    const pitchTasks = tasks.filter((t) => pitchScopeIds.has(t.scopeId))

    const pitchUpdates = updates.filter((u) => u.pitchId === p.id)
    const latestUpdate =
      pitchUpdates.length > 0
        ? pitchUpdates.reduce((a, b) =>
            a.posted_at > b.posted_at ? a : b
          )
        : null

    return {
      id: p.id,
      title: p.title,
      stage: p.stage,
      needle: p.needle,
      tasksDone: pitchTasks.filter((t) => t.done).length,
      tasksTotal: pitchTasks.length,
      lastUpdatedAt: latestUpdate?.posted_at ?? null,
      timebox_start: p.timebox_start,
      timebox_end: p.timebox_end,
    }
  })
}

export function partitionByStage(cards: PitchCard[]): {
  inFlight: PitchCard[]
  done: PitchCard[]
} {
  return {
    inFlight: cards.filter((c) => c.stage !== 'done'),
    done: cards.filter((c) => c.stage === 'done'),
  }
}
