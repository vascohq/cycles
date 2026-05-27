import type { Zone, NeedleSnapshot, PitchUpdate } from '@/cycle-liveblocks.config'

const SNAP_VALUES: Record<Zone, number> = {
  on_track: 0.85,
  some_risk: 0.5,
  concerned: 0.2,
}

export function snapForZone(zone: Zone): number {
  return SNAP_VALUES[zone]
}

export function clampProgress(progress: number): number {
  return Math.min(0.98, Math.max(0.02, progress))
}

export function deriveGhost(updates: PitchUpdate[]): NeedleSnapshot | null {
  if (updates.length === 0) return null
  const latest = updates.reduce((a, b) =>
    a.posted_at > b.posted_at ? a : b
  )
  return latest.needle_snapshot
}
