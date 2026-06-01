import { describe, it, expect } from 'vitest'
import {
  clampProgress,
  SHIPPED_NEEDLE,
  deriveGhost,
  needleAfterDeletingLatest,
} from './needle-engine'
import type { NeedleSnapshot, PitchUpdate } from '@/cycle-liveblocks.config'

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

describe('SHIPPED_NEEDLE', () => {
  it('is a frozen needle at full progress, on_track zone', () => {
    expect(SHIPPED_NEEDLE).toEqual({ progress: 1, zone: 'on_track' })
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
        timebox_snapshot: { daysLeft: 30, currentWeek: 2, totalWeeks: 6 },
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
        timebox_snapshot: { daysLeft: 23, currentWeek: 3, totalWeeks: 6 },
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
        timebox_snapshot: { daysLeft: 23, currentWeek: 3, totalWeeks: 6 },
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
        timebox_snapshot: { daysLeft: 30, currentWeek: 2, totalWeeks: 6 },
      },
    ]

    expect(deriveGhost(updates)).toEqual({ progress: 0.8, zone: 'on_track' })
  })
})

describe('needleAfterDeletingLatest', () => {
  const mk = (
    id: string,
    pitchId: string,
    posted_at: string,
    snap: NeedleSnapshot
  ): PitchUpdate => ({
    id,
    pitchId,
    posted_at,
    posted_by: 'user_1',
    narrative: '',
    needle_snapshot: snap,
    hill_snapshot: [],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 30, currentWeek: 2, totalWeeks: 6 },
  })

  it('reverts to the prior update snapshot when one remains', () => {
    const updates = [
      mk('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' }),
      mk('u2', 'p1', '2026-06-10T10:00:00Z', { progress: 0.7, zone: 'on_track' }),
    ]
    expect(needleAfterDeletingLatest(updates, 'p1', 'u2')).toEqual({
      progress: 0.3,
      zone: 'concerned',
    })
  })

  it('returns null when the deleted update was the only one', () => {
    const updates = [
      mk('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' }),
    ]
    expect(needleAfterDeletingLatest(updates, 'p1', 'u1')).toBeNull()
  })

  it('ignores updates from other pitches when finding the prior', () => {
    const updates = [
      mk('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' }),
      mk('o1', 'p2', '2026-06-09T10:00:00Z', { progress: 0.9, zone: 'on_track' }),
      mk('u2', 'p1', '2026-06-10T10:00:00Z', { progress: 0.7, zone: 'on_track' }),
    ]
    expect(needleAfterDeletingLatest(updates, 'p1', 'u2')).toEqual({
      progress: 0.3,
      zone: 'concerned',
    })
  })
})
