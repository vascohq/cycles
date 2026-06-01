import type { Needle, NeedleSnapshot, PitchUpdate } from '@/cycle-liveblocks.config'

export function clampProgress(progress: number): number {
  return Math.min(0.98, Math.max(0.02, progress))
}

// The needle moves in discrete steps spanning the full 0%–100% range.
export const NEEDLE_STEP_COUNT = 12

// Snap an arbitrary position to the nearest step, clamped to [0, 1] so the
// first step is a true 0% and the last a true 100% (unlike clampProgress, which
// keeps the tip just off the arc ends for the display-only gauge).
export function snapNeedleProgress(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round(clamped * NEEDLE_STEP_COUNT) / NEEDLE_STEP_COUNT
}

export const SHIPPED_NEEDLE: NeedleSnapshot = { progress: 1, zone: 'on_track' }

export function deriveGhost(updates: PitchUpdate[]): NeedleSnapshot | null {
  if (updates.length === 0) return null
  const latest = updates.reduce((a, b) =>
    a.posted_at > b.posted_at ? a : b
  )
  return latest.needle_snapshot
}

// What a pitch's needle should become after its latest update is deleted (the
// misfire-undo escape hatch — see ADR 0006). Deleting the latest update reverts
// the denormalized needle to the prior update's snapshot, since the on-page
// needle is display-only and its only source of truth is the last posted
// update. Returns null when the deleted update was the only one, returning the
// pitch to its unset/grey state.
//
// `updates` is the full list (any pitch); only those matching `pitchId` are
// considered, and `latestUpdateId` is the update being deleted — it must be the
// latest for that pitch (callers enforce latest-only; this just computes the
// revert target from what remains).
export function needleAfterDeletingLatest(
  updates: PitchUpdate[],
  pitchId: string,
  latestUpdateId: string
): Needle | null {
  const remaining = updates.filter(
    (u) => u.pitchId === pitchId && u.id !== latestUpdateId
  )
  const prior = deriveGhost(remaining)
  return prior ? { progress: prior.progress, zone: prior.zone } : null
}
