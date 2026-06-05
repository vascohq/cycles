import { describe, it, expect } from 'vitest'
import { computeTimebox, dayTicks } from './timebox-engine'

describe('computeTimebox', () => {
  // Jun 1 2026 is a Monday; the span [Jun 1, Jun 15) holds two working weeks
  // (Jun 1–5 and Jun 8–12) = 10 business days. Weekends count as zero.
  it('counts only business days for an active timebox', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-08')
    expect(info.phase).toBe('active')
    expect(info.totalDays).toBe(10)
    expect(info.dayNumber).toBe(6)
    expect(info.daysLeft).toBe(5)
    expect(info.fractionElapsed).toBeCloseTo(0.5, 5)
  })

  // Jun 6/7 2026 are Sat/Sun. The countdown must not tick across the weekend.
  it('holds the countdown flat across the weekend', () => {
    const sat = computeTimebox('2026-06-01', '2026-06-15', '2026-06-06')
    const sun = computeTimebox('2026-06-01', '2026-06-15', '2026-06-07')
    expect(sat).toEqual(sun)
    expect(sat.daysLeft).toBe(5)
    // Friday still counts itself as remaining; the weekend reflects Friday done.
    const fri = computeTimebox('2026-06-01', '2026-06-15', '2026-06-05')
    expect(fri.daysLeft).toBe(6)
  })

  it('returns before phase when today is before start', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-05-28')
    expect(info.phase).toBe('before')
    expect(info.fractionElapsed).toBe(0)
    expect(info.dayNumber).toBe(0)
    expect(info.daysLeft).toBe(10)
  })

  it('returns after phase when today is past end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-20')
    expect(info.phase).toBe('after')
    expect(info.fractionElapsed).toBe(1)
    expect(info.daysLeft).toBe(0)
    expect(info.dayNumber).toBe(10)
  })

  it('returns day 1 on the start date', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-01')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(1)
    expect(info.fractionElapsed).toBe(0)
  })

  // Jun 12 (Fri) is the last working day of the span; the following Mon is day 10.
  it('returns the last business day on the final working day', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-12')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(10)
    expect(info.daysLeft).toBe(1)
  })

  // One week = 5 business days. Jan 6 2025 (Mon) → Feb 17 (Mon, exclusive) is
  // six full Mon–Fri weeks = 30 business days.
  it('treats one week as five business days for a 6-week build cycle', () => {
    const info = computeTimebox('2025-01-06', '2025-02-17', '2025-01-20')
    expect(info.totalDays).toBe(30)
    expect(info.totalWeeks).toBe(6)
    expect(info.currentWeek).toBe(3)
  })

  it('returns currentWeek 0 before start', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-05-28')
    expect(info.currentWeek).toBe(0)
  })

  it('returns currentWeek equal to totalWeeks after end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-15', '2026-06-20')
    expect(info.currentWeek).toBe(info.totalWeeks)
  })

  it('returns a safe zero state when dates are missing or invalid', () => {
    for (const info of [
      computeTimebox('', '', ''),
      computeTimebox('not-a-date', '2026-06-15', '2026-06-08'),
      computeTimebox('2026-06-01', '2026-06-01', '2026-06-01'),
      // Jun 6 (Sat) → Jun 8 (Mon, exclusive): nothing but weekend, zero business days.
      computeTimebox('2026-06-06', '2026-06-08', '2026-06-06'),
    ]) {
      expect(info.phase).toBe('before')
      expect(info.fractionElapsed).toBe(0)
      expect(Number.isFinite(info.fractionElapsed)).toBe(true)
      expect(info.totalDays).toBe(0)
    }
  })
})

describe('dayTicks', () => {
  it('returns one tick per business day with major every 5 to mark week boundaries', () => {
    const ticks = dayTicks(10)
    expect(ticks).toHaveLength(10)
    expect(ticks[4].major).toBe(true)
    expect(ticks[9].major).toBe(true)
    expect(ticks[0].major).toBe(false)
  })

  it('positions ticks evenly across 0..1', () => {
    const ticks = dayTicks(10)
    expect(ticks[0].position).toBeCloseTo(1 / 10, 2)
    expect(ticks[9].position).toBeCloseTo(1, 2)
  })
})
