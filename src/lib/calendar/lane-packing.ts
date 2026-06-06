import type { PositionedBand } from './overlay-positioning'

export type PlacedBand = { band: PositionedBand; lane: number }

export type PackedBands = {
  placed: PlacedBand[]
  laneCount: number
}

// A hair of slack so two bands that merely touch at an edge can share a lane.
const EPSILON = 0.001

/**
 * Greedy interval partitioning: assign each band (sorted by start) to the first
 * lane whose previous band has already ended, opening a new lane only when none
 * is free. This stacks overlapping events into parallel rows so each stays
 * individually visible and hoverable, instead of burying one another.
 */
export function packLanes(bands: PositionedBand[]): PackedBands {
  const sorted = [...bands].sort((a, b) => a.leftFraction - b.leftFraction)
  const laneEnds: number[] = []

  const placed = sorted.map((band) => {
    const right = band.leftFraction + band.widthFraction
    let lane = laneEnds.findIndex((end) => band.leftFraction >= end - EPSILON)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(right)
    } else {
      laneEnds[lane] = right
    }
    return { band, lane }
  })

  return { placed, laneCount: laneEnds.length }
}
