// Pure, date-driven engine for the Cycles list and default landing. A cycle's
// lifecycle phase is DERIVED from its dates against the team's "today" (ISO date
// string, resolved in the team timezone — see team-time.ts), never stored. There
// is no "archived" flag; a past cycle simply ends (ADR 0015). Phase is a plain
// calendar-string compare — ISO YYYY-MM-DD sorts lexically — independent of the
// business-day math in timebox-engine, so an undated cycle is caught explicitly
// rather than masquerading as "upcoming".

export type CyclePhase = 'upcoming' | 'current' | 'past' | 'undated'

export type CycleSummary = {
  slug: string
  title: string
  type: 'build' | 'cooldown'
  /** ISO date (YYYY-MM-DD), or '' when unset. */
  start_date: string
  end_date: string
}

/** True for a well-formed ISO calendar date (YYYY-MM-DD) that names a real day. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value + 'T00:00:00Z').getTime())
}

export function cyclePhase(cycle: CycleSummary, today: string): CyclePhase {
  if (!isIsoDate(cycle.start_date) || !isIsoDate(cycle.end_date)) return 'undated'
  if (today < cycle.start_date) return 'upcoming'
  if (today >= cycle.end_date) return 'past'
  return 'current'
}

export type LandingTarget = { kind: 'cycle'; slug: string } | { kind: 'list' }

// Default landing is the top of the sorted `current` group — i.e. the most
// recently begun current cycle, the same rule the list uses (deterministic when
// spans overlap). No current cycle → the list (ADR 0015).
export function resolveLanding(
  cycles: CycleSummary[],
  today: string
): LandingTarget {
  const [latest] = groupCycles(cycles, today).current
  return latest ? { kind: 'cycle', slug: latest.slug } : { kind: 'list' }
}

export type GroupedCycles = {
  current: CycleSummary[]
  upcoming: CycleSummary[]
  past: CycleSummary[]
  undated: CycleSummary[]
}

export function groupCycles(
  cycles: CycleSummary[],
  today: string
): GroupedCycles {
  const groups: GroupedCycles = { current: [], upcoming: [], past: [], undated: [] }
  for (const c of cycles) groups[cyclePhase(c, today)].push(c)

  const byStartAsc = (a: CycleSummary, b: CycleSummary) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0
  const byStartDesc = (a: CycleSummary, b: CycleSummary) => byStartAsc(b, a)

  // Upcoming reads as a countdown (soonest next). Current and past read newest
  // first — the live cycle on top, the freshest history just below the fold.
  groups.upcoming.sort(byStartAsc)
  groups.current.sort(byStartDesc)
  groups.past.sort(byStartDesc)
  return groups
}
