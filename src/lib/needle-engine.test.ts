import { describe, it, expect } from 'vitest'
import { snapForZone, clampProgress, deriveGhost } from './needle-engine'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

describe('snapForZone', () => {
  it('snaps on_track to 0.85', () => {
    expect(snapForZone('on_track')).toBe(0.85)
  })

  it('snaps some_risk to 0.5', () => {
    expect(snapForZone('some_risk')).toBe(0.5)
  })

  it('snaps concerned to 0.2', () => {
    expect(snapForZone('concerned')).toBe(0.2)
  })
})

describe('clampProgress', () => {
  it('clamps 0 to 0.02', () => {
    expect(clampProgress(0)).toBe(0.02)
  })

  it('clamps 1.0 to 0.98', () => {
    expect(clampProgress(1.0)).toBe(0.98)
  })

  it('clamps negative values to 0.02', () => {
    expect(clampProgress(-0.5)).toBe(0.02)
  })

  it('passes through mid-range values unchanged', () => {
    expect(clampProgress(0.5)).toBe(0.5)
  })
})

describe('deriveGhost', () => {
  it('returns null when no updates exist', () => {
    expect(deriveGhost([])).toBeNull()
  })

  it('returns needle snapshot from the latest update by posted_at', () => {
    const updates: PitchUpdate[] = [
      {
        id: 'u1',
        pitchId: 'p1',
        posted_at: '2026-06-03T10:00:00Z',
        posted_by: 'user_1',
        narrative: 'First update',
        needle_snapshot: { progress: 0.3, zone: 'concerned' },
        hill_snapshot: [],
        task_snapshot: [],
      },
      {
        id: 'u2',
        pitchId: 'p1',
        posted_at: '2026-06-10T10:00:00Z',
        posted_by: 'user_1',
        narrative: 'Second update',
        needle_snapshot: { progress: 0.7, zone: 'on_track' },
        hill_snapshot: [],
        task_snapshot: [],
      },
    ]

    expect(deriveGhost(updates)).toEqual({ progress: 0.7, zone: 'on_track' })
  })

  it('picks latest even when updates are not in chronological order', () => {
    const updates: PitchUpdate[] = [
      {
        id: 'u2',
        pitchId: 'p1',
        posted_at: '2026-06-10T10:00:00Z',
        posted_by: 'user_1',
        narrative: 'Later',
        needle_snapshot: { progress: 0.8, zone: 'on_track' },
        hill_snapshot: [],
        task_snapshot: [],
      },
      {
        id: 'u1',
        pitchId: 'p1',
        posted_at: '2026-06-03T10:00:00Z',
        posted_by: 'user_1',
        narrative: 'Earlier',
        needle_snapshot: { progress: 0.2, zone: 'concerned' },
        hill_snapshot: [],
        task_snapshot: [],
      },
    ]

    expect(deriveGhost(updates)).toEqual({ progress: 0.8, zone: 'on_track' })
  })
})
