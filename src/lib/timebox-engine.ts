// All quantities here are measured in BUSINESS DAYS (Mon–Fri); weekends count
// as zero and one week = 5 business days. Shared by a pitch Timebox and the
// Cycle window (ADR 0010, ADR 0013). "today" is resolved in the team timezone
// (see team-time.ts) before it reaches this pure engine.

export type TimeboxPhase = 'before' | 'active' | 'after'

export type TimeboxInfo = {
  fractionElapsed: number
  dayNumber: number
  daysLeft: number
  totalDays: number
  totalWeeks: number
  currentWeek: number
  phase: TimeboxPhase
}

const msPerDay = 86_400_000

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay()
  return day !== 0 && day !== 6
}

/** Count of Monday–Friday days in the half-open span [a, b). NaN if either date is invalid. */
function businessDaysBetween(a: string, b: string): number {
  const start = new Date(a + 'T00:00:00Z').getTime()
  const end = new Date(b + 'T00:00:00Z').getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN
  if (end <= start) return 0
  let count = 0
  for (let t = start; t < end; t += msPerDay) {
    if (isBusinessDay(new Date(t))) count++
  }
  return count
}

export type DayTick = {
  position: number
  major: boolean
}

export function dayTicks(totalDays: number): DayTick[] {
  return Array.from({ length: totalDays }, (_, i) => ({
    position: (i + 1) / totalDays,
    major: (i + 1) % DAYS_PER_WEEK === 0,
  }))
}

const DAYS_PER_WEEK = 5

export function computeTimebox(start: string, end: string, today: string): TimeboxInfo {
  const totalDays = businessDaysBetween(start, end)

  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return { fractionElapsed: 0, dayNumber: 0, daysLeft: 0, totalDays: 0, totalWeeks: 0, currentWeek: 0, phase: 'before' }
  }

  const totalWeeks = Math.ceil(totalDays / DAYS_PER_WEEK)

  if (today < start) {
    return { fractionElapsed: 0, dayNumber: 0, daysLeft: totalDays, totalDays, totalWeeks, currentWeek: 0, phase: 'before' }
  }

  if (today >= end) {
    return { fractionElapsed: 1, dayNumber: totalDays, daysLeft: 0, totalDays, totalWeeks, currentWeek: totalWeeks, phase: 'after' }
  }

  const elapsed = businessDaysBetween(start, today)

  return {
    fractionElapsed: elapsed / totalDays,
    dayNumber: elapsed + 1,
    daysLeft: totalDays - elapsed,
    totalDays,
    totalWeeks,
    currentWeek: Math.min(Math.floor(elapsed / DAYS_PER_WEEK) + 1, totalWeeks),
    phase: 'active',
  }
}
