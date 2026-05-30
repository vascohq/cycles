import type { NeedleSnapshot, PitchUpdate } from '@/cycle-liveblocks.config'

export function clampProgress(progress: number): number {
  return Math.min(0.98, Math.max(0.02, progress))
}

export const SHIPPED_NEEDLE: NeedleSnapshot = { progress: 1, zone: 'on_track' }

export function deriveGhost(updates: PitchUpdate[]): NeedleSnapshot | null {
  if (updates.length === 0) return null
  const latest = updates.reduce((a, b) =>
    a.posted_at > b.posted_at ? a : b
  )
  return latest.needle_snapshot
}
