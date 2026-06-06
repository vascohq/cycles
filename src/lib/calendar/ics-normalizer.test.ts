import { describe, it, expect } from 'vitest'
import { normalizeIcsFeed } from './ics-normalizer'

const RANGE = { start: '2026-06-01', end: '2026-08-31' }

function ics(...vevents: string[][]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    ...vevents.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n')
}

describe('normalizeIcsFeed', () => {
  it('normalizes an all-day holiday to a single inclusive-date band', () => {
    const feed = ics([
      'UID:canada-day-2026',
      'SUMMARY:Canada Day',
      'DTSTART;VALUE=DATE:20260701',
      'DTEND;VALUE=DATE:20260702',
    ])

    const bands = normalizeIcsFeed(feed, { kind: 'holiday', label: 'Canada' }, RANGE)

    expect(bands).toEqual([
      {
        kind: 'holiday',
        label: 'Canada',
        summary: 'Canada Day',
        startDate: '2026-07-01',
        endDate: '2026-07-01',
      },
    ])
  })

  it('lands a Europe/Paris event on its local calendar date, not UTC', () => {
    const feed = ics([
      'UID:bastille-2026',
      'SUMMARY:Bastille Day',
      'DTSTART;TZID=Europe/Paris:20260714T000000',
      'DTEND;TZID=Europe/Paris:20260715T000000',
    ])

    const bands = normalizeIcsFeed(feed, { kind: 'holiday', label: 'France' }, RANGE)

    expect(bands).toEqual([
      {
        kind: 'holiday',
        label: 'France',
        summary: 'Bastille Day',
        startDate: '2026-07-14',
        endDate: '2026-07-14',
      },
    ])
  })

  it('expands a yearly recurring holiday into the range only', () => {
    const feed = ics([
      'UID:canada-day',
      'SUMMARY:Canada Day',
      'DTSTART;VALUE=DATE:20200701',
      'DTEND;VALUE=DATE:20200702',
      'RRULE:FREQ=YEARLY',
    ])

    const bands = normalizeIcsFeed(feed, { kind: 'holiday', label: 'Canada' }, RANGE)

    expect(bands).toEqual([
      {
        kind: 'holiday',
        label: 'Canada',
        summary: 'Canada Day',
        startDate: '2026-07-01',
        endDate: '2026-07-01',
      },
    ])
  })

  it('renders a multi-day absence as a single span', () => {
    const feed = ics([
      'UID:jeremy-vacances',
      'SUMMARY:Jeremy — Vacances',
      'DTSTART;VALUE=DATE:20260804',
      'DTEND;VALUE=DATE:20260809',
    ])

    const bands = normalizeIcsFeed(feed, { kind: 'timeoff', label: 'Humi' }, RANGE)

    expect(bands).toEqual([
      {
        kind: 'timeoff',
        label: 'Humi',
        summary: 'Jeremy — Vacances',
        startDate: '2026-08-04',
        endDate: '2026-08-08',
      },
    ])
  })

  it('widens a timed half-day to a full-day band', () => {
    const feed = ics([
      'UID:half-day',
      'SUMMARY:Sarah — Afternoon off',
      'DTSTART;TZID=America/Toronto:20260805T130000',
      'DTEND;TZID=America/Toronto:20260805T170000',
    ])

    const bands = normalizeIcsFeed(feed, { kind: 'timeoff', label: 'Humi' }, RANGE)

    expect(bands).toEqual([
      {
        kind: 'timeoff',
        label: 'Humi',
        summary: 'Sarah — Afternoon off',
        startDate: '2026-08-05',
        endDate: '2026-08-05',
      },
    ])
  })

  it('returns an empty list for a malformed feed instead of throwing', () => {
    const garbage = 'this is not a calendar at all <html>404</html>'

    expect(normalizeIcsFeed(garbage, { kind: 'holiday', label: 'Canada' }, RANGE)).toEqual([])
  })

  it('returns an empty list when the feed cannot be parsed instead of throwing', () => {
    const feed = ics([
      'UID:broken',
      'SUMMARY:Broken recurrence',
      'DTSTART;VALUE=DATE:20200701',
      'DTEND;VALUE=DATE:20200702',
      'RRULE:FREQ=NONSENSE',
    ])

    expect(normalizeIcsFeed(feed, { kind: 'holiday', label: 'Canada' }, RANGE)).toEqual([])
  })
})
