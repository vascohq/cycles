import { describe, it, expect } from 'vitest'
import { packLanes } from './lane-packing'
import type { PositionedBand } from './overlay-positioning'

const band = (leftFraction: number, widthFraction: number, summary = ''): PositionedBand => ({
  kind: 'timeoff',
  label: 'Humi',
  summary,
  leftFraction,
  widthFraction,
})

describe('packLanes', () => {
  it('keeps non-overlapping bands in a single lane', () => {
    const { laneCount, placed } = packLanes([band(0, 0.2, 'a'), band(0.5, 0.2, 'b')])

    expect(laneCount).toBe(1)
    expect(placed.every((p) => p.lane === 0)).toBe(true)
  })

  it('pushes an overlapping band to the next lane', () => {
    const { laneCount, placed } = packLanes([band(0, 0.3, 'a'), band(0.2, 0.3, 'b')])

    expect(laneCount).toBe(2)
    expect(placed.map((p) => p.lane).sort()).toEqual([0, 1])
  })

  it('packs three mutually overlapping bands into three lanes', () => {
    const { laneCount } = packLanes([band(0, 0.5, 'a'), band(0.1, 0.5, 'b'), band(0.2, 0.5, 'c')])

    expect(laneCount).toBe(3)
  })

  it('reuses a freed lane once an earlier band has ended', () => {
    // a:[0,0.2) and c:[0.3,0.5) don't overlap, so c reuses lane 0; b overlaps a.
    const { laneCount, placed } = packLanes([
      band(0, 0.2, 'a'),
      band(0.1, 0.2, 'b'),
      band(0.3, 0.2, 'c'),
    ])

    expect(laneCount).toBe(2)
    const bySummary = Object.fromEntries(placed.map((p) => [p.band.summary, p.lane]))
    expect(bySummary.a).toBe(0)
    expect(bySummary.b).toBe(1)
    expect(bySummary.c).toBe(0)
  })

  it('returns at least one lane for an empty input', () => {
    expect(packLanes([])).toEqual({ placed: [], laneCount: 0 })
  })
})
