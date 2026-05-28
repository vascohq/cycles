import { describe, it, expect } from 'vitest'
import { buildUpdate, weekOfTimebox, isTuesday } from './update-engine'

describe('buildUpdate', () => {
  it('produces a PitchUpdate with correct snapshots from current state', () => {
    const update = buildUpdate({
      pitchId: 'p1',
      userId: 'user1',
      zone: 'on_track',
      narrative: 'Good progress this week',
      currentNeedle: { progress: 0.6, zone: 'some_risk' },
      scopes: [
        { id: 's1', hill_progress: 0.3 },
        { id: 's2', hill_progress: 0.7 },
      ],
      tasks: [
        { scopeId: 's1', done: true },
        { scopeId: 's1', done: false },
        { scopeId: 's2', done: true },
        { scopeId: 's2', done: true },
      ],
    })

    expect(update.pitchId).toBe('p1')
    expect(update.posted_by).toBe('user1')
    expect(update.narrative).toBe('Good progress this week')
    expect(update.needle_snapshot).toEqual({ progress: 0.85, zone: 'on_track' })
    expect(update.hill_snapshot).toEqual([
      { scopeId: 's1', hill_progress: 0.3 },
      { scopeId: 's2', hill_progress: 0.7 },
    ])
    expect(update.task_snapshot).toEqual([
      { scopeId: 's1', done: 1, total: 2 },
      { scopeId: 's2', done: 2, total: 2 },
    ])
    expect(update.id).toBeTruthy()
    expect(update.posted_at).toBeTruthy()
  })
})

describe('weekOfTimebox', () => {
  it('returns week 1 on the first day of a 6-week cycle', () => {
    expect(weekOfTimebox('2025-01-06', '2025-02-14', '2025-01-06')).toBe(1)
  })

  it('returns correct week number mid-cycle', () => {
    expect(weekOfTimebox('2025-01-06', '2025-02-14', '2025-01-20')).toBe(3)
  })

  it('returns the last week at end of cycle', () => {
    expect(weekOfTimebox('2025-01-06', '2025-02-14', '2025-02-14')).toBe(6)
  })
})

describe('isTuesday', () => {
  it('returns true on a Tuesday', () => {
    expect(isTuesday('2025-01-07')).toBe(true)
  })

  it('returns false on a Wednesday', () => {
    expect(isTuesday('2025-01-08')).toBe(false)
  })
})
