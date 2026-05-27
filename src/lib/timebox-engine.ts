export type TimeboxPhase = 'before' | 'active' | 'after'

export type TimeboxInfo = {
  fractionElapsed: number
  dayNumber: number
  daysLeft: number
  totalDays: number
  phase: TimeboxPhase
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / msPerDay
  )
}

export type DayTick = {
  position: number
  major: boolean
}

export function dayTicks(totalDays: number): DayTick[] {
  return Array.from({ length: totalDays }, (_, i) => ({
    position: (i + 1) / totalDays,
    major: (i + 1) % 7 === 0,
  }))
}

export function computeTimebox(start: string, end: string, today: string): TimeboxInfo {
  const totalDays = daysBetween(start, end)
  const elapsed = daysBetween(start, today)

  if (elapsed < 0) {
    return { fractionElapsed: 0, dayNumber: 0, daysLeft: totalDays, totalDays, phase: 'before' }
  }

  if (elapsed >= totalDays) {
    return { fractionElapsed: 1, dayNumber: totalDays, daysLeft: 0, totalDays, phase: 'after' }
  }

  return {
    fractionElapsed: elapsed / totalDays,
    dayNumber: elapsed + 1,
    daysLeft: totalDays - elapsed,
    totalDays,
    phase: 'active',
  }
}
