import type { Stage } from '@/cycle-liveblocks.config'

// The pitch lifecycle, in order. A pitch moves forward (or back) through these.
// Framing happens on the pitch, before the betting table (ADR 0032). "Frame Go"
// is framing → shaping, and "Shape Go" is shaping → building.
export const STAGES: Stage[] = ['framing', 'shaping', 'building', 'done']

// Where a newly created pitch starts. A build cycle's pitch starts at
// `framing`. A cooldown pitch starts at `building`, because cooldown work is
// picked up already shaped.
export function newShapeStage(cycleType: 'build' | 'cooldown'): Stage {
  return cycleType === 'cooldown' ? 'building' : 'framing'
}

// Normalize a stage read out of storage. Anything unrecognized reads as
// `shaping`, the stage every pitch had before framing returned, rather than
// breaking a lookup keyed by Stage.
export function readStage(stored: string | undefined): Stage {
  return (STAGES as string[]).includes(stored ?? '') ? (stored as Stage) : 'shaping'
}

// The next stage forward, or null if already at the last stage (`done`).
export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}

// The previous stage, or null if already at the first stage (`framing`).
export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return i > 0 ? STAGES[i - 1] : null
}

// A pitch is automatically marked `done` once its needle reaches 100% — posting
// a 100% update is the act of shipping. Below 100% the stage is left unchanged.
export function stageAfterNeedle(needleProgress: number, stage: Stage): Stage {
  return needleProgress >= 1 ? 'done' : stage
}
