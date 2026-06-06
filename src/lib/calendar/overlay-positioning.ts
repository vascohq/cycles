import type { OverlayBand } from './ics-normalizer'

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

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / MS_PER_DAY
  )
}

export function positionBands(bands: OverlayBand[], window: Window): PositionedBand[] {
  const totalDays = daysBetween(window.start, window.end)
  if (totalDays <= 0) return []

  const positioned: PositionedBand[] = []

  for (const band of bands) {
    // Day offsets from the window start; the band spans [start, end] inclusive,
    // so its trailing edge is one day past its last day.
    const rawLeft = daysBetween(window.start, band.startDate)
    const rawRight = daysBetween(window.start, band.endDate) + 1

    // Clip to the window; drop bands with no visible overlap.
    const left = Math.max(0, rawLeft)
    const right = Math.min(totalDays, rawRight)
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
