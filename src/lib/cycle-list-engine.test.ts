import { describe, expect, it } from 'vitest'
import {
  cyclePhase,
  groupCycles,
  resolveLanding,
  type CycleSummary,
} from './cycle-list-engine'

function cycle(overrides: Partial<CycleSummary> = {}): CycleSummary {
  return {
    slug: 'build-1',
    title: 'Build 1',
    type: 'build',
    start_date: '2026-06-01',
    end_date: '2026-07-13',
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
})
