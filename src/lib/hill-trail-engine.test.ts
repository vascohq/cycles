import { describe, it, expect } from 'vitest'
import { diffHillTrail } from './hill-trail-engine'
import type { HillSnapshot } from '@/cycle-liveblocks.config'

describe('diffHillTrail', () => {
  it('marks a scope that advanced several steps as moved with a positive step delta', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.2 }]
    const current = [{ id: 's1', hill_progress: 0.6 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail).toMatchObject({
      scopeId: 's1',
      state: 'moved',
      fromProgress: 0.2,
      toProgress: 0.6,
    })
    expect(trail.stepDelta).toBeGreaterThan(0)
  })

  it('marks a scope at the same hill step as stagnant with a zero step delta', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.5 }]
    const current = [{ id: 's1', hill_progress: 0.5 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail).toMatchObject({ state: 'stagnant', stepDelta: 0 })
  })

  it('marks a scope that slid back as moved with a negative step delta', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.7 }]
    const current = [{ id: 's1', hill_progress: 0.3 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail.state).toBe('moved')
    expect(trail.stepDelta).toBeLessThan(0)
  })

  it('treats movement within a single step as stagnant', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.5 }]
    const current = [{ id: 's1', hill_progress: 0.53 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail).toMatchObject({ state: 'stagnant', stepDelta: 0 })
  })

  it('matches by id regardless of order and returns only scopes present in both', () => {
    const previous: HillSnapshot[] = [
      { scopeId: 's2', hill_progress: 0.4 },
      { scopeId: 's1', hill_progress: 0.1 },
    ]
    const current = [
      { id: 's1', hill_progress: 0.5 },
      { id: 's3', hill_progress: 0.2 },
    ]

    const trails = diffHillTrail(previous, current)

    expect(trails).toHaveLength(1)
    expect(trails[0]).toMatchObject({
      scopeId: 's1',
      fromProgress: 0.1,
      toProgress: 0.5,
    })
  })
})
