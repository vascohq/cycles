import { describe, it, expect } from 'vitest'
import { deriveZone, snapForZone, clampProgress, deriveGhost } from './needle-engine'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

describe('deriveZone', () => {
  it('returns concerned for progress 0', () => {
    expect(deriveZone(0)).toBe('concerned')
  })

  it('returns concerned for progress just below 0.33', () => {
    expect(deriveZone(0.32)).toBe('concerned')
  })

  it('returns some_risk at exactly 0.33', () => {
    expect(deriveZone(0.33)).toBe('some_risk')
  })

  it('returns some_risk for progress just below 0.66', () => {
    expect(deriveZone(0.65)).toBe('some_risk')
  })

  it('returns on_track at exactly 0.66', () => {
    expect(deriveZone(0.66)).toBe('on_track')
  })

  it('returns on_track for progress 1.0', () => {
    expect(deriveZone(1.0)).toBe('on_track')
  })
})

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
