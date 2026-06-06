import type { Stage } from '@/cycle-liveblocks.config'

// The pitch lifecycle, in order. A pitch moves forward (or back) through these.
export const STAGES: Stage[] = ['framing', 'shaping', 'building', 'done']

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
