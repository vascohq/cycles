/**
 * The single canonical clock for the whole app. "Days left" and "today" are
 * properties of the cycle, not the viewer, so everyone — including remote
 * teammates — reads the same Montreal calendar date. See ADR 0013.
 */
export const TEAM_TIMEZONE = 'America/Montreal'

/** The current calendar date in the team timezone, as a YYYY-MM-DD string. */
export function getTeamToday(now: Date): string {
  // en-CA formats as YYYY-MM-DD; the timeZone option handles DST automatically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TEAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
