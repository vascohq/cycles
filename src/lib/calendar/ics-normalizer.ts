import { sync, type VEvent } from 'node-ical'

export type OverlayBand = {
  kind: 'holiday' | 'timeoff'
  label: string
  summary: string
  startDate: string
  endDate: string
}

export type FeedMeta = {
  kind: 'holiday' | 'timeoff'
  label: string
}

export type DateRange = {
  start: string
  end: string
}

/** A node-ical Date carries an optional IANA `tz` for zoned (date-time) events. */
type ZonedDate = Date & { tz?: string }

/**
 * The calendar day a Date falls on, 'YYYY-MM-DD'. Zoned events resolve in their
 * own timezone (so a Paris midnight stays July 14, not July 13 in UTC); all-day
 * and floating events resolve in the runtime's local zone, where node-ical
 * places them at local midnight.
 */
function calendarDay(date: ZonedDate): string {
  if (date.tz) {
    // en-CA formats as 'YYYY-MM-DD'.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: date.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MS_PER_DAY = 86_400_000

/** Build a whole-day band from a start instant and an *exclusive* end instant. */
function toBand(start: Date, end: Date, tz: string | undefined, feed: FeedMeta, summary: string): OverlayBand {
  // ICS DTEND is exclusive: the inclusive last day is the day containing the
  // instant just before the end. This collapses a timed half-day onto its own
  // date and trims an all-day event's trailing exclusive day.
  return {
    kind: feed.kind,
    label: feed.label,
    summary,
    startDate: calendarDay(zoned(start, tz)),
    endDate: calendarDay(zoned(new Date(end.getTime() - 1), tz)),
  }
}

function zoned(date: Date, tz: string | undefined): ZonedDate {
  const z = new Date(date.getTime()) as ZonedDate
  z.tz = tz
  return z
}

export function normalizeIcsFeed(
  icsText: string,
  feed: FeedMeta,
  range: DateRange
): OverlayBand[] {
  let parsed: ReturnType<typeof sync.parseICS>
  try {
    // node-ical validates recurrence rules eagerly and throws on a bad feed; a
    // calendar we can't parse contributes no bands rather than breaking render.
    parsed = sync.parseICS(icsText)
  } catch {
    return []
  }

  const bands: OverlayBand[] = []

  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (!component || component.type !== 'VEVENT') continue
    const event = component as VEvent

    const start = event.start as ZonedDate
    const end = event.end as Date
    const summary = String(event.summary ?? '')

    if (event.rrule) {
      // Expand recurrences into the visible range (widened a day each side so a
      // tz-edge occurrence isn't dropped). Each occurrence keeps the seed's
      // duration so multi-day recurring events stay multi-day.
      const durationMs = end.getTime() - start.getTime()
      const from = new Date(new Date(range.start + 'T00:00:00Z').getTime() - MS_PER_DAY)
      const to = new Date(new Date(range.end + 'T00:00:00Z').getTime() + MS_PER_DAY)
      for (const occurrence of event.rrule.between(from, to, true)) {
        bands.push(toBand(occurrence, new Date(occurrence.getTime() + durationMs), start.tz, feed, summary))
      }
      continue
    }

    bands.push(toBand(start, end, start.tz, feed, summary))
  }

  return bands
}
