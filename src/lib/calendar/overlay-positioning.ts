import type { OverlayBand } from './ics-normalizer'
import { businessDaysBetween } from '@/lib/timebox-engine'

export type PositionedBand = {
  kind: 'holiday' | 'timeoff'
  label: string
  summary: string
  leftFraction: number
  widthFraction: number
  /** A weekend Holiday shifted to its observed (in-lieu) business day. */
  observed?: boolean
}

/** An overlay band that may have been shifted to an observed business day. */
export type ObservedBand = OverlayBand & { observed?: boolean }

export type Window = {
  start: string
  end: string
}

const MS_PER_DAY = 86_400_000

function dayAfter(date: string): string {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + MS_PER_DAY).toISOString().slice(0, 10)
}

function isWeekend(date: string): boolean {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay()
  return dow === 0 || dow === 6
}

function nextBusinessDay(date: string): string {
  let d = date
  while (isWeekend(d)) d = dayAfter(d)
  return d
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max)

/**
 * Statutory holidays that land entirely on a weekend are observed on the next
 * business day (the "day in lieu" — e.g. Boxing Day on a Saturday is taken the
 * following Monday). Shift such Holidays to that business day and flag them
 * `observed` so the UI can mark them as in-lieu (dashed) rather than the literal
 * date. Holidays that already touch a weekday, and all Time Off, pass through
 * unchanged.
 */
export function observeHolidays(bands: OverlayBand[]): ObservedBand[] {
  return bands.map((band) => {
    if (band.kind !== 'holiday') return band
    // Leave it alone if any business day already falls inside the holiday.
    if (businessDaysBetween(band.startDate, dayAfter(band.endDate)) > 0) return band

    const observedDate = nextBusinessDay(band.startDate)
    return { ...band, startDate: observedDate, endDate: observedDate, observed: true }
  })
}

/**
 * Map each overlay band onto fractional [0,1] positions within the window,
 * clipping to its bounds and dropping bands with no visible overlap. Positions
 * are measured in **business days** to match the timebox/cycle-window tape
 * (ADR 0013), so each hairline lands exactly on the tape's ticks — weekends
 * carry zero width, so a purely-weekend event collapses and is dropped. Bands
 * stay individual (one per Holiday / person's Time Off); the cycle-window row
 * lane-stacks overlaps so each remains hoverable (see CalendarOverlayRow).
 */
export function positionBands(bands: ObservedBand[], window: Window): PositionedBand[] {
  const totalDays = businessDaysBetween(window.start, window.end)
  if (!Number.isFinite(totalDays) || totalDays <= 0) return []

  const positioned: PositionedBand[] = []

  for (const band of bands) {
    // Business-day offsets from the window start; [start, end] is inclusive, so
    // the trailing edge is the business-day count up to the day after end.
    const left = clamp(businessDaysBetween(window.start, band.startDate), totalDays)
    const right = clamp(businessDaysBetween(window.start, dayAfter(band.endDate)), totalDays)
    if (right <= left) continue

    positioned.push({
      kind: band.kind,
      label: band.label,
      summary: band.summary,
      leftFraction: left / totalDays,
      widthFraction: (right - left) / totalDays,
      ...(band.observed ? { observed: true } : {}),
    })
  }

  return positioned
}
