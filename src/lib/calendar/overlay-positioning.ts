import type { OverlayBand } from './ics-normalizer'
import { businessDaysBetween } from '@/lib/timebox-engine'

export type PositionedBand = {
  kind: 'holiday' | 'timeoff'
  label: string
  summary: string
  leftFraction: number
  widthFraction: number
}

export type Window = {
  start: string
  end: string
}

const MS_PER_DAY = 86_400_000

function dayAfter(date: string): string {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + MS_PER_DAY).toISOString().slice(0, 10)
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max)

/**
 * Map each overlay band onto fractional [0,1] positions within the window,
 * clipping to its bounds and dropping bands with no visible overlap. Positions
 * are measured in **business days** to match the timebox/cycle-window tape
 * (ADR 0013), so each hairline lands exactly on the tape's ticks — weekends
 * carry zero width, so a purely-weekend event collapses and is dropped. Bands
 * stay individual (one per Holiday / person's Time Off); the cycle-window row
 * lane-stacks overlaps so each remains hoverable (see CalendarOverlayRow).
 */
export function positionBands(bands: OverlayBand[], window: Window): PositionedBand[] {
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
    })
  }

  return positioned
}
