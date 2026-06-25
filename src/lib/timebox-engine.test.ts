import { describe, it, expect } from 'vitest'
import { computeTimebox, dayTicks, windowFraction } from './timebox-engine'

describe('computeTimebox', () => {
  // Jun 1 2026 is a Monday; Jun 1 → Fri Jun 12 (inclusive) holds two working
  // weeks (Jun 1–5 and Jun 8–12) = 10 business days. Weekends count as zero.
  it('counts only business days for an active timebox', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-08')
    expect(info.phase).toBe('active')
    expect(info.totalDays).toBe(10)
    expect(info.dayNumber).toBe(6)
    expect(info.daysLeft).toBe(5)
    expect(info.fractionElapsed).toBeCloseTo(0.5, 5)
  })

  // Jun 6/7 2026 are Sat/Sun. The countdown must not tick across the weekend.
  it('holds the countdown flat across the weekend', () => {
    const sat = computeTimebox('2026-06-01', '2026-06-12', '2026-06-06')
    const sun = computeTimebox('2026-06-01', '2026-06-12', '2026-06-07')
    expect(sat).toEqual(sun)
    expect(sat.daysLeft).toBe(5)
    // Friday still counts itself as remaining; the weekend reflects Friday done.
    const fri = computeTimebox('2026-06-01', '2026-06-12', '2026-06-05')
    expect(fri.daysLeft).toBe(6)
  })

  it('returns before phase when today is before start', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-05-28')
    expect(info.phase).toBe('before')
    expect(info.fractionElapsed).toBe(0)
    expect(info.dayNumber).toBe(0)
    expect(info.daysLeft).toBe(10)
  })

  it('returns after phase when today is past end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-20')
    expect(info.phase).toBe('after')
    expect(info.fractionElapsed).toBe(1)
    expect(info.daysLeft).toBe(0)
    expect(info.dayNumber).toBe(10)
  })

  it('returns day 1 on the start date', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-01')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(1)
    expect(info.fractionElapsed).toBe(0)
  })

  // Jun 12 (Fri) is the inclusive end — the last working day, day 10 of 10,
  // active with one day left (itself).
  it('returns the last business day on the final working day', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-12')
    expect(info.phase).toBe('active')
    expect(info.dayNumber).toBe(10)
    expect(info.daysLeft).toBe(1)
  })

  // The day after the inclusive end flips to complete.
  it('returns after phase the day after the inclusive end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-15')
    expect(info.phase).toBe('after')
    expect(info.daysLeft).toBe(0)
  })

  // One week = 5 business days. Jan 6 2025 (Mon) → Fri Feb 14 (inclusive) is
  // six full Mon–Fri weeks = 30 business days.
  it('treats one week as five business days for a 6-week build cycle', () => {
    const info = computeTimebox('2025-01-06', '2025-02-14', '2025-01-20')
    expect(info.totalDays).toBe(30)
    expect(info.totalWeeks).toBe(6)
    expect(info.currentWeek).toBe(3)
  })

  // `end` is the INCLUSIVE last working day (ADR 0013 correction 2026-06-25).
  // Mon Jan 6 2025 → Fri Feb 14 (inclusive) is six full Mon–Fri weeks = 30 days,
  // and that final Friday is still a working day of the cycle.
  it('counts the inclusive end date as the final working day', () => {
    const fri = computeTimebox('2025-01-06', '2025-02-14', '2025-02-14')
    expect(fri.totalDays).toBe(30)
    expect(fri.totalWeeks).toBe(6)
    expect(fri.phase).toBe('active')
    expect(fri.dayNumber).toBe(30)
    expect(fri.daysLeft).toBe(1)
  })

  it('returns currentWeek 0 before start', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-05-28')
    expect(info.currentWeek).toBe(0)
  })

  it('returns currentWeek equal to totalWeeks after end', () => {
    const info = computeTimebox('2026-06-01', '2026-06-12', '2026-06-20')
    expect(info.currentWeek).toBe(info.totalWeeks)
  })

  it('returns a safe zero state when dates are missing or invalid', () => {
    for (const info of [
      computeTimebox('', '', ''),
      computeTimebox('not-a-date', '2026-06-15', '2026-06-08'),
      // end before start: empty span, zero business days.
      computeTimebox('2026-06-02', '2026-06-01', '2026-06-01'),
      // Jun 6 (Sat) → Jun 7 (Sun) inclusive: nothing but weekend, zero business days.
      computeTimebox('2026-06-06', '2026-06-07', '2026-06-06'),
    ]) {
      expect(info.phase).toBe('before')
      expect(info.fractionElapsed).toBe(0)
      expect(Number.isFinite(info.fractionElapsed)).toBe(true)
      expect(info.totalDays).toBe(0)
    }
  })
})

describe('windowFraction', () => {
  // Mon Jan 6 → Fri Feb 14 2025 (inclusive) = 30 business days. Positions divide
  // by 30 (the tape's denominator), and the day after the inclusive end is 1.0.
  const start = '2025-01-06'
  const end = '2025-02-14'

  it('places the start at 0', () => {
    expect(windowFraction(start, end, start)).toBe(0)
  })

  it('places the inclusive last working day a cell short of the end', () => {
    // Fri Feb 14 is business day 30: its start edge sits at 29/30, not 1.0.
    expect(windowFraction(start, end, end)).toBeCloseTo(29 / 30, 5)
  })

  it('places the day after the inclusive end at the full extent', () => {
    expect(windowFraction(start, end, '2025-02-15')).toBe(1)
  })

  it('clamps dates outside the window to [0, 1]', () => {
    expect(windowFraction(start, end, '2024-12-01')).toBe(0)
    expect(windowFraction(start, end, '2025-12-01')).toBe(1)
  })

  it('returns 0 for a degenerate window', () => {
    expect(windowFraction('', '', '2025-01-06')).toBe(0)
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

  // Regression: a Mon→Fri 6-week cycle's final week must show 5 spots closed by
  // a major tick — not 4 (the dropped-last-day bug).
  it('closes the final week of a 6-week cycle with a major tick', () => {
    const { totalDays } = computeTimebox('2025-01-06', '2025-02-14', '2025-01-20')
    const ticks = dayTicks(totalDays)
    expect(ticks).toHaveLength(30)
    expect(ticks[29].major).toBe(true)
  })

  it('positions ticks evenly across 0..1', () => {
    const ticks = dayTicks(10)
    expect(ticks[0].position).toBeCloseTo(1 / 10, 2)
    expect(ticks[9].position).toBeCloseTo(1, 2)
  })
})
