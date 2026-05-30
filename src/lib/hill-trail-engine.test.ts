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
    if (trail.state !== 'moved') throw new Error('expected moved')
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
    if (trail.state !== 'moved') throw new Error('expected moved')
    expect(trail.stepDelta).toBeLessThan(0)
  })

  it('treats movement within a single step as stagnant', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.5 }]
    const current = [{ id: 's1', hill_progress: 0.53 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail).toMatchObject({ state: 'stagnant', stepDelta: 0 })
  })

  it('matches by id regardless of order', () => {
    const previous: HillSnapshot[] = [
      { scopeId: 's2', hill_progress: 0.4 },
      { scopeId: 's1', hill_progress: 0.1 },
    ]
    const current = [{ id: 's1', hill_progress: 0.5 }]

    const trail = diffHillTrail(previous, current).find(
      (t) => t.scopeId === 's1'
    )

    expect(trail).toMatchObject({
      scopeId: 's1',
      fromProgress: 0.1,
      toProgress: 0.5,
    })
  })

  it('marks a scope absent from the previous snapshot as new', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.2 }]
    const current = [
      { id: 's1', hill_progress: 0.3 },
      { id: 's2', hill_progress: 0.6 },
    ]

    const trail = diffHillTrail(previous, current).find(
      (t) => t.scopeId === 's2'
    )

    expect(trail).toMatchObject({ scopeId: 's2', state: 'new', toProgress: 0.6 })
    expect(trail).not.toHaveProperty('fromProgress')
  })

  it('marks a scope absent from the live set as dropped, carrying frozen title and tier', () => {
    const previous: HillSnapshot[] = [
      { scopeId: 's1', hill_progress: 0.3 },
      { scopeId: 's2', hill_progress: 0.8, title: 'Dark mode', tier: 'could' },
    ]
    const current = [{ id: 's1', hill_progress: 0.4 }]

    const trail = diffHillTrail(previous, current).find(
      (t) => t.scopeId === 's2'
    )

    expect(trail).toMatchObject({
      scopeId: 's2',
      state: 'dropped',
      fromProgress: 0.8,
      title: 'Dark mode',
      tier: 'could',
    })
    expect(trail).not.toHaveProperty('toProgress')
  })

  it('drops a pre-enrichment snapshot scope with no title or tier', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 0.8 }]
    const current: { id: string; hill_progress: number }[] = []

    const [trail] = diffHillTrail(previous, current)

    expect(trail).toMatchObject({
      scopeId: 's1',
      state: 'dropped',
      fromProgress: 0.8,
    })
    expect(trail).not.toHaveProperty('title')
    expect(trail).not.toHaveProperty('tier')
  })

  it('treats every live scope as new when the previous snapshot is empty', () => {
    const current = [
      { id: 's1', hill_progress: 0.2 },
      { id: 's2', hill_progress: 0.5 },
    ]

    const trails = diffHillTrail([], current)

    expect(trails).toHaveLength(2)
    expect(trails.every((t) => t.state === 'new')).toBe(true)
  })
})
