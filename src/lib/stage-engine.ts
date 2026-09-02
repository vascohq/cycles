import type { Stage } from '@/cycle-liveblocks.config'

// The shape lifecycle, in order. A shape moves forward (or back) through these.
// There is no `framing` stage: framing happens on the Product Map, before a
// shape exists (see ADR 0023). `shaping` stays, because shaping work really
// does happen inside the cycle.
export const STAGES: Stage[] = ['shaping', 'building', 'done']

// Where a newly created shape starts. A build cycle's shape starts at
// `shaping`. A cooldown shape starts at `building`, because cooldown work is
// picked up already shaped.
export function newShapeStage(cycleType: 'build' | 'cooldown'): Stage {
  return cycleType === 'cooldown' ? 'building' : 'shaping'
}

// Normalize a stage read out of storage. Rooms written before ADR 0023 hold
// `framing`, which now reads as `shaping` — stored data outlives the code that
// wrote it, and nothing rewrites those rooms. Anything unrecognized falls back
// to the first stage rather than breaking a lookup keyed by Stage.
export function readStage(stored: string | undefined): Stage {
  return (STAGES as string[]).includes(stored ?? '')
    ? (stored as Stage)
    : STAGES[0]
}

// The next stage forward, or null if already at the last stage (`done`).
export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}

// The previous stage, or null if already at the first stage (`shaping`).
export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return i > 0 ? STAGES[i - 1] : null
}

// A pitch is automatically marked `done` once its needle reaches 100% — posting
// a 100% update is the act of shipping. Below 100% the stage is left unchanged.
export function stageAfterNeedle(needleProgress: number, stage: Stage): Stage {
  return needleProgress >= 1 ? 'done' : stage
}
