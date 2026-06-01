import { describe, it, expect } from 'vitest'
import {
  diffHillTrail,
  rollupHillTrails,
  noChangeStreaks,
  summarizeMovement,
} from './hill-trail-engine'
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

  it('labels a stagnant scope "Didn\'t move"', () => {
    const previous: HillSnapshot[] = [{ scopeId: 's1', hill_progress: 5 / 14 }]
    const current = [{ id: 's1', hill_progress: 5 / 14 }]

    const [trail] = diffHillTrail(previous, current)

    expect(trail.label).toBe("Didn't move")
  })

  it('labels a 1–2 step forward move "Nudged forward"', () => {
    const oneStep = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 2 / 14 }]
    )[0]
    const twoStep = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 3 / 14 }]
    )[0]

    expect(oneStep.label).toBe('Nudged forward')
    expect(twoStep.label).toBe('Nudged forward')
  })

  it('labels a 3+ step forward move "Lots of progress"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 5 / 14 }]
    )

    expect(trail.label).toBe('Lots of progress')
  })

  it('labels any backward move "Slid back"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 9 / 14 }],
      [{ id: 's1', hill_progress: 5 / 14 }]
    )

    expect(trail.label).toBe('Slid back')
  })

  it('labels landing on the crest "At the top"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 3 / 14 }],
      [{ id: 's1', hill_progress: 0.5 }]
    )

    expect(trail.label).toBe('At the top')
  })

  it('labels crossing the crest onto the downhill side "Crossed the hill"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 5 / 14 }],
      [{ id: 's1', hill_progress: 9 / 14 }]
    )

    expect(trail.label).toBe('Crossed the hill')
  })

  it('labels further downhill progress (already past the crest) "Heading down"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 9 / 14 }],
      [{ id: 's1', hill_progress: 12 / 14 }]
    )

    expect(trail.label).toBe('Heading down')
  })

  it('labels reaching the end "Done"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 11 / 14 }],
      [{ id: 's1', hill_progress: 1 }]
    )

    expect(trail.label).toBe('Done')
  })

  it('does not call a forward move below the crest "At the top"', () => {
    const [trail] = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 6 / 14 }]
    )

    expect(trail.label).toBe('Lots of progress')
  })

  it('labels new and dropped scopes "New" and "Dropped"', () => {
    const trails = diffHillTrail(
      [{ scopeId: 'gone', hill_progress: 0.6 }],
      [{ id: 'fresh', hill_progress: 0.2 }]
    )

    expect(trails.find((t) => t.scopeId === 'fresh')?.label).toBe('New')
    expect(trails.find((t) => t.scopeId === 'gone')?.label).toBe('Dropped')
  })

  it('tallies a count rollup of moved / stalled / new / dropped', () => {
    const previous: HillSnapshot[] = [
      { scopeId: 'mover', hill_progress: 1 / 14 },
      { scopeId: 'stuck', hill_progress: 5 / 14 },
      { scopeId: 'gone', hill_progress: 0.8 },
    ]
    const current = [
      { id: 'mover', hill_progress: 5 / 14 },
      { id: 'stuck', hill_progress: 5 / 14 },
      { id: 'fresh', hill_progress: 0.3 },
    ]

    const rollup = rollupHillTrails(diffHillTrail(previous, current))

    expect(rollup).toEqual({ moved: 1, stalled: 1, new: 1, dropped: 1 })
  })
})

describe('noChangeStreaks', () => {
  it('counts consecutive updates a scope held its current step', () => {
    const snapshotsNewestFirst: HillSnapshot[][] = [
      [{ scopeId: 's1', hill_progress: 0.5 }],
      [{ scopeId: 's1', hill_progress: 0.5 }],
    ]
    const live = [{ id: 's1', hill_progress: 0.5 }]

    expect(noChangeStreaks(snapshotsNewestFirst, live).get('s1')).toBe(2)
  })

  it('reports a streak of 0 for a scope that moved since the last update', () => {
    const snapshots: HillSnapshot[][] = [[{ scopeId: 's1', hill_progress: 0.3 }]]
    const live = [{ id: 's1', hill_progress: 0.6 }]

    expect(noChangeStreaks(snapshots, live).get('s1')).toBe(0)
  })

  it('stops counting at the first update where the step differs', () => {
    const snapshots: HillSnapshot[][] = [
      [{ scopeId: 's1', hill_progress: 0.5 }],
      [{ scopeId: 's1', hill_progress: 0.5 }],
      [{ scopeId: 's1', hill_progress: 0.2 }],
    ]
    const live = [{ id: 's1', hill_progress: 0.5 }]

    expect(noChangeStreaks(snapshots, live).get('s1')).toBe(2)
  })

  it('stops counting when the scope is absent from an older snapshot', () => {
    const snapshots: HillSnapshot[][] = [
      [{ scopeId: 's1', hill_progress: 0.5 }],
      [], // scope did not exist this far back
    ]
    const live = [{ id: 's1', hill_progress: 0.5 }]

    expect(noChangeStreaks(snapshots, live).get('s1')).toBe(1)
  })
})

describe('summarizeMovement', () => {
  const titles = new Map([
    ['s1', 'Checkout'],
    ['s2', 'Login'],
    ['s3', 'Auth'],
  ])

  it('names a scope that reached the top', () => {
    const trails = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 3 / 14 }],
      [{ id: 's1', hill_progress: 0.5 }]
    )
    const line = summarizeMovement(trails, noChangeStreaks([], []), titles)
    expect(line).toContain('⛰️ Checkout at the top')
  })

  it('celebrates a scope that reached done', () => {
    const trails = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 11 / 14 }],
      [{ id: 's1', hill_progress: 1 }]
    )
    const line = summarizeMovement(trails, noChangeStreaks([], []), titles)
    expect(line).toContain('🎉 Checkout done!')
  })

  it('distinguishes a big climb from a small nudge', () => {
    const bigClimb = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 5 / 14 }]
    )
    expect(summarizeMovement(bigClimb, new Map(), titles)).toBe('⏫ Checkout big climb')

    const nudge = diffHillTrail(
      [{ scopeId: 's1', hill_progress: 1 / 14 }],
      [{ id: 's1', hill_progress: 2 / 14 }]
    )
    expect(summarizeMovement(nudge, new Map(), titles)).toBe('🔼 Checkout nudged up')
  })

  it('distinguishes sliding back a little from a lot', () => {
    const little = diffHillTrail(
      [{ scopeId: 's2', hill_progress: 5 / 14 }],
      [{ id: 's2', hill_progress: 3 / 14 }]
    )
    expect(summarizeMovement(little, new Map(), titles)).toBe('🔻 Login slid back')

    const lot = diffHillTrail(
      [{ scopeId: 's2', hill_progress: 9 / 14 }],
      [{ id: 's2', hill_progress: 3 / 14 }]
    )
    expect(summarizeMovement(lot, new Map(), titles)).toBe('⏬ Login slid way back')
  })

  it('names new and dropped scopes with their emoji', () => {
    const trails = diffHillTrail(
      [{ scopeId: 's3', hill_progress: 0.5, title: 'Auth' }],
      [{ id: 's1', hill_progress: 0.2 }]
    )
    const line = summarizeMovement(trails, new Map(), titles) ?? ''
    expect(line).toContain('🆕 Checkout')
    expect(line).toContain('❌ Auth')
  })

  it('names each nudged scope', () => {
    const trails = diffHillTrail(
      [
        { scopeId: 's1', hill_progress: 1 / 14 },
        { scopeId: 's2', hill_progress: 1 / 14 },
      ],
      [
        { id: 's1', hill_progress: 2 / 14 },
        { id: 's2', hill_progress: 3 / 14 },
      ]
    )
    expect(summarizeMovement(trails, new Map(), titles)).toBe(
      '🔼 Checkout nudged up · 🔼 Login nudged up'
    )
  })

  it('caps named movers and overflows the rest into "+N more"', () => {
    const current = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, hill_progress: 0.1 }))
    const line = summarizeMovement(diffHillTrail([], current), new Map(), new Map()) ?? ''
    expect(line.match(/🆕/g)?.length).toBe(3)
    expect(line).toContain('+2 more')
  })

  it('collapses an all-quiet update to a count and names the longest streaks', () => {
    const snapshots: HillSnapshot[][] = [
      [
        { scopeId: 's1', hill_progress: 0.3 },
        { scopeId: 's2', hill_progress: 0.3 },
        { scopeId: 's3', hill_progress: 0.3 },
      ],
      [
        { scopeId: 's1', hill_progress: 0.3 },
        { scopeId: 's2', hill_progress: 0.3 },
      ],
    ]
    const live = [
      { id: 's1', hill_progress: 0.3 },
      { id: 's2', hill_progress: 0.3 },
      { id: 's3', hill_progress: 0.3 },
    ]
    const line = summarizeMovement(diffHillTrail(snapshots[0], live), noChangeStreaks(snapshots, live), titles)
    // s1 & s2 held for 2 updates (longest), s3 only 1.
    expect(line).toBe('⏸️ No hill movement · 3 unchanged\nlongest 2 updates: Checkout, Login (+1)')
  })

  it('puts movers and a quiet count on separate lines when both occur', () => {
    const trails = diffHillTrail(
      [
        { scopeId: 's1', hill_progress: 5 / 14 },
        { scopeId: 's2', hill_progress: 0.5 },
      ],
      [
        { id: 's1', hill_progress: 9 / 14 }, // crossed the hill
        { id: 's2', hill_progress: 0.5 }, // unchanged
      ]
    )
    const line = summarizeMovement(trails, noChangeStreaks([], []), titles) ?? ''
    const [movers, quiet] = line.split('\n')
    expect(movers).toContain('🏂 Checkout crossed the hill')
    expect(quiet).toBe('⏸️ 1 unchanged')
  })

  it('returns null when there are no scopes to report on', () => {
    expect(summarizeMovement([], new Map(), new Map())).toBeNull()
  })
})
