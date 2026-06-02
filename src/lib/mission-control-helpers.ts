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
  emoji: string
  stage: Stage
  needle: Needle | null
  tasksDone: number
  tasksTotal: number
  scopesTotal: number
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
      emoji: p.emoji ?? '',
      stage: p.stage,
      needle: p.needle,
      tasksDone: pitchTasks.filter((t) => t.done).length,
      tasksTotal: pitchTasks.length,
      scopesTotal: pitchScopeIds.size,
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

// Most-active work first, finished work last. Used to order pitches within a
// Mission Control section (and, later, within each squad section — see #98).
const STAGE_ORDER: Record<Stage, number> = {
  building: 0,
  shaping: 1,
  framing: 2,
  done: 3,
}

/**
 * Order pitches by stage progression: building → shaping → framing → done.
 * Stable within a stage (preserves input order) and non-mutating.
 */
export function sortByStageProgression(cards: PitchCard[]): PitchCard[] {
  return [...cards].sort(
    (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
  )
}
