import { describe, it, expect } from 'vitest'
import { computeTimebox, dayTicks } from './timebox-engine'

describe('computeTimebox', () => {
  it('returns correct fraction, day number, and days left for an active timebox', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-08')
    expect(info.phase).toBe('active')
    expect(info.totalDays).toBe(14)
    expect(info.dayNumber).toBe(8)
    expect(info.daysLeft).toBe(7)
    expect(info.fractionElapsed).toBeCloseTo(0.5, 1)
  })

  it('returns before phase when today is before start', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-05-28')
    expect(info.phase).toBe('before')
    expect(info.fractionElapsed).toBe(0)
    expect(info.dayNumber).toBe(0)
    expect(info.daysLeft).toBe(14)
  })

  it('returns after phase when today is past end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-20')
    expect(info.phase).toBe('after')
    expect(info.fractionElapsed).toBe(1)
    expect(info.daysLeft).toBe(0)
    expect(info.dayNumber).toBe(14)
  })

  it('returns day 1 on the start date', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-01')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(1)
    expect(info.fractionElapsed).toBe(0)
  })

  it('returns last day on the day before end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-14')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(14)
    expect(info.daysLeft).toBe(1)
  })
})

describe('dayTicks', () => {
  it('returns one tick per day with major every 7 days', () => {
    const ticks = dayTicks(14)
    expect(ticks).toHaveLength(14)
    expect(ticks[6].major).toBe(true)
    expect(ticks[13].major).toBe(true)
    expect(ticks[0].major).toBe(false)
  })

  it('positions ticks evenly across 0..1', () => {
    const ticks = dayTicks(14)
    expect(ticks[0].position).toBeCloseTo(1 / 14, 2)
    expect(ticks[13].position).toBeCloseTo(1, 2)
  })
})
