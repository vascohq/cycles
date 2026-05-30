import { describe, it, expect } from 'vitest'
import { buildUpdate } from './update-engine'

describe('buildUpdate', () => {
  it('produces a PitchUpdate with correct snapshots from current state', () => {
    const update = buildUpdate({
      pitchId: 'p1',
      userId: 'user1',
      progress: 0.42,
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
      timebox: { daysLeft: 20, currentWeek: 3, totalWeeks: 6 },
    })

    expect(update.pitchId).toBe('p1')
    expect(update.posted_by).toBe('user1')
    expect(update.narrative).toBe('Good progress this week')
    expect(update.needle_snapshot).toEqual({ progress: 0.42, zone: 'on_track' })
    expect(update.hill_snapshot).toEqual([
      { scopeId: 's1', hill_progress: 0.3 },
      { scopeId: 's2', hill_progress: 0.7 },
    ])
    expect(update.task_snapshot).toEqual([
      { scopeId: 's1', done: 1, total: 2 },
      { scopeId: 's2', done: 2, total: 2 },
    ])
    expect(update.timebox_snapshot).toEqual({ daysLeft: 20, currentWeek: 3, totalWeeks: 6 })
    expect(update.id).toBeTruthy()
    expect(update.posted_at).toBeTruthy()
  })
})

