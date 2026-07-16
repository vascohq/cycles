import { describe, expect, it } from 'vitest'
import {
  cyclePhase,
  groupCycles,
  resolveLanding,
  cycleNeighbors,
  type CycleSummary,
} from './cycle-list-engine'

function cycle(overrides: Partial<CycleSummary> = {}): CycleSummary {
  return {
    slug: 'build-1',
    title: 'Build 1',
    type: 'build',
    start_date: '2026-06-01',
    end_date: '2026-07-13',
    archived: false,
    ...overrides,
  }
}

describe('cyclePhase', () => {
  it('is current when today falls within the window', () => {
    expect(cyclePhase(cycle(), '2026-06-15')).toBe('current')
  })

  it('is upcoming when today is before the start', () => {
    expect(cyclePhase(cycle(), '2026-05-20')).toBe('upcoming')
  })

  it('is past on or after the end date (end-exclusive)', () => {
    expect(cyclePhase(cycle(), '2026-07-20')).toBe('past')
    expect(cyclePhase(cycle(), '2026-07-13')).toBe('past')
  })

  it('is undated when either date is missing or invalid', () => {
    expect(cyclePhase(cycle({ start_date: '' }), '2026-06-15')).toBe('undated')
    expect(cyclePhase(cycle({ end_date: '' }), '2026-06-15')).toBe('undated')
    expect(cyclePhase(cycle({ start_date: '', end_date: '' }), '2026-06-15')).toBe('undated')
    expect(cyclePhase(cycle({ start_date: 'not-a-date' }), '2026-06-15')).toBe('undated')
  })
})

describe('resolveLanding', () => {
  it('lands on the current cycle when exactly one is current', () => {
    const cycles = [
      cycle({ slug: 'past-1', start_date: '2026-04-01', end_date: '2026-05-13' }),
      cycle({ slug: 'now-1', start_date: '2026-06-01', end_date: '2026-07-13' }),
      cycle({ slug: 'next-1', start_date: '2026-08-01', end_date: '2026-09-13' }),
    ]
    expect(resolveLanding(cycles, '2026-06-15')).toEqual({ kind: 'cycle', slug: 'now-1' })
  })

  it('falls back to the list when no cycle is current', () => {
    const cycles = [
      cycle({ slug: 'past-1', start_date: '2026-04-01', end_date: '2026-05-13' }),
      cycle({ slug: 'next-1', start_date: '2026-08-01', end_date: '2026-09-13' }),
    ]
    expect(resolveLanding(cycles, '2026-06-15')).toEqual({ kind: 'list' })
    expect(resolveLanding([], '2026-06-15')).toEqual({ kind: 'list' })
  })

  it('picks the latest-started cycle when several overlap as current', () => {
    const cycles = [
      cycle({ slug: 'early', start_date: '2026-05-01', end_date: '2026-07-13' }),
      cycle({ slug: 'late', start_date: '2026-06-10', end_date: '2026-07-20' }),
    ]
    expect(resolveLanding(cycles, '2026-06-15')).toEqual({ kind: 'cycle', slug: 'late' })
  })

  it('never lands on an archived cycle, even if it is the only current one', () => {
    const cycles = [
      cycle({ slug: 'oops', start_date: '2026-06-01', end_date: '2026-07-13', archived: true }),
    ]
    expect(resolveLanding(cycles, '2026-06-15')).toEqual({ kind: 'list' })
  })

  it('lands on the next non-archived current cycle when the latest is archived', () => {
    const cycles = [
      cycle({ slug: 'live', start_date: '2026-05-20', end_date: '2026-07-13' }),
      cycle({ slug: 'oops', start_date: '2026-06-10', end_date: '2026-07-20', archived: true }),
    ]
    expect(resolveLanding(cycles, '2026-06-15')).toEqual({ kind: 'cycle', slug: 'live' })
  })
})

describe('groupCycles', () => {
  const slugs = (cs: CycleSummary[]) => cs.map((c) => c.slug)

  it('buckets cycles by phase into current/upcoming/past/undated', () => {
    const cycles = [
      cycle({ slug: 'past-1', start_date: '2026-04-01', end_date: '2026-05-13' }),
      cycle({ slug: 'now-1', start_date: '2026-06-01', end_date: '2026-07-13' }),
      cycle({ slug: 'next-1', start_date: '2026-08-01', end_date: '2026-09-13' }),
      cycle({ slug: 'undated-1', start_date: '', end_date: '' }),
    ]
    const groups = groupCycles(cycles, '2026-06-15')
    expect(slugs(groups.current)).toEqual(['now-1'])
    expect(slugs(groups.upcoming)).toEqual(['next-1'])
    expect(slugs(groups.past)).toEqual(['past-1'])
    expect(slugs(groups.undated)).toEqual(['undated-1'])
  })

  it('sorts upcoming soonest-first, past and current most-recently-started first', () => {
    const cycles = [
      cycle({ slug: 'up-late', start_date: '2026-10-01', end_date: '2026-11-13' }),
      cycle({ slug: 'up-soon', start_date: '2026-08-01', end_date: '2026-09-13' }),
      cycle({ slug: 'past-old', start_date: '2026-01-01', end_date: '2026-02-13' }),
      cycle({ slug: 'past-recent', start_date: '2026-04-01', end_date: '2026-05-13' }),
      cycle({ slug: 'now-early', start_date: '2026-05-20', end_date: '2026-07-13' }),
      cycle({ slug: 'now-late', start_date: '2026-06-10', end_date: '2026-07-20' }),
    ]
    const groups = groupCycles(cycles, '2026-06-15')
    expect(slugs(groups.upcoming)).toEqual(['up-soon', 'up-late'])
    expect(slugs(groups.past)).toEqual(['past-recent', 'past-old'])
    expect(slugs(groups.current)).toEqual(['now-late', 'now-early'])
  })

  it('buckets archived cycles into the archived group regardless of their dates', () => {
    const cycles = [
      cycle({ slug: 'now-1', start_date: '2026-06-01', end_date: '2026-07-13' }),
      // A "current" cycle that has been archived must not appear as current.
      cycle({ slug: 'oops', start_date: '2026-06-01', end_date: '2026-07-13', archived: true }),
      cycle({ slug: 'undated-archived', start_date: '', end_date: '', archived: true }),
    ]
    const groups = groupCycles(cycles, '2026-06-15')
    expect(slugs(groups.current)).toEqual(['now-1'])
    expect(slugs(groups.undated)).toEqual([])
    expect(slugs(groups.archived)).toEqual(['oops', 'undated-archived'])
  })
})


describe('cycleNeighbors', () => {
  const cycles = [
    cycle({ slug: 'c2', start_date: '2026-03-01' }),
    cycle({ slug: 'c1', start_date: '2026-01-01' }),
    cycle({ slug: 'c3', start_date: '2026-05-01' }),
  ]

  it('returns the chronological previous and next by start_date', () => {
    const { prev, next } = cycleNeighbors(cycles, 'c2')
    expect(prev?.slug).toBe('c1')
    expect(next?.slug).toBe('c3')
  })

  it('has no previous for the earliest cycle', () => {
    const { prev, next } = cycleNeighbors(cycles, 'c1')
    expect(prev).toBeNull()
    expect(next?.slug).toBe('c2')
  })

  it('has no next for the latest cycle', () => {
    const { prev, next } = cycleNeighbors(cycles, 'c3')
    expect(prev?.slug).toBe('c2')
    expect(next).toBeNull()
  })

  it('returns nulls for an unknown slug', () => {
    expect(cycleNeighbors(cycles, 'nope')).toEqual({ prev: null, next: null })
  })

  it('skips archived cycles when stepping to prev/next', () => {
    const withArchived = [
      cycle({ slug: 'c1', start_date: '2026-01-01' }),
      cycle({ slug: 'c2-archived', start_date: '2026-03-01', archived: true }),
      cycle({ slug: 'c3', start_date: '2026-05-01' }),
    ]
    // From c1, the next live cycle is c3 (c2 is archived and hidden from stepping).
    expect(cycleNeighbors(withArchived, 'c1').next?.slug).toBe('c3')
    expect(cycleNeighbors(withArchived, 'c3').prev?.slug).toBe('c1')
  })
})
