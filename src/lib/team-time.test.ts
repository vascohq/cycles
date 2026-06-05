import { describe, it, expect } from 'vitest'
import { TEAM_TIMEZONE, getTeamToday } from './team-time'

describe('getTeamToday', () => {
  it('uses Montreal as the single team timezone', () => {
    expect(TEAM_TIMEZONE).toBe('America/Montreal')
  })

  it('returns the Montreal calendar date, not UTC, across the midnight boundary (EDT)', () => {
    // 02:00 UTC on Jun 6 is still 22:00 on Jun 5 in Montreal (EDT, UTC-4).
    expect(getTeamToday(new Date('2026-06-06T02:00:00Z'))).toBe('2026-06-05')
  })

  it('honours standard time in winter (EST)', () => {
    // 02:00 UTC on Jan 6 is 21:00 on Jan 5 in Montreal (EST, UTC-5).
    expect(getTeamToday(new Date('2026-01-06T02:00:00Z'))).toBe('2026-01-05')
  })
})
