import type { OverlayBand } from './ics-normalizer'
import { clusterTimeOff, type TimeOffMember } from './time-off-clustering'

export type PositionedBand = {
  kind: 'holiday' | 'timeoff'
  label: string
  summary: string
  leftFraction: number
  widthFraction: number
  /** For a Time Off cluster: everyone away in this span (length >= 1). */
  members?: TimeOffMember[]
}

export type Window = {
  start: string
  end: string
}

/** Minimal shape positionBands needs; OverlayBand and a cluster both satisfy it. */
type PositionableBand = {
  kind: 'holiday' | 'timeoff'
  label: string
  summary: string
  startDate: string
  endDate: string
  members?: TimeOffMember[]
}

const MS_PER_DAY = 86_400_000

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / MS_PER_DAY
  )
}

export function positionBands(bands: PositionableBand[], window: Window): PositionedBand[] {
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
      ...(band.members ? { members: band.members } : {}),
    })
  }

  return positioned
}

/**
 * Position every overlay band for a window: Holidays stay individual (each is
 * location-wide), while Time Off is first clustered so overlapping absences
 * merge into one band that can name everyone away (see clusterTimeOff). The
 * cluster's `summary` is the lone person's name, or "N away" when several
 * overlap; the full roster rides along in `members` for the tooltip.
 */
export function buildOverlay(bands: OverlayBand[], window: Window): PositionedBand[] {
  const holidays = bands.filter((b) => b.kind === 'holiday')
  const timeOff = bands.filter((b) => b.kind === 'timeoff')

  const clusters: PositionableBand[] = clusterTimeOff(timeOff).map((cluster) => ({
    kind: 'timeoff',
    label: cluster.label,
    summary:
      cluster.members.length === 1
        ? cluster.members[0]!.summary
        : `${cluster.members.length} away`,
    startDate: cluster.startDate,
    endDate: cluster.endDate,
    members: cluster.members,
  }))

  return positionBands([...holidays, ...clusters], window)
}
