import { describe, it, expect } from 'vitest'
import { positionBands } from './overlay-positioning'
import type { OverlayBand } from './ics-normalizer'

// A 14-day window: 2026-06-01 .. 2026-06-15.
const WINDOW = { start: '2026-06-01', end: '2026-06-15' }

const holiday = (startDate: string, endDate: string, summary = 'Holiday'): OverlayBand => ({
  kind: 'holiday',
  label: 'Canada',
  summary,
  startDate,
  endDate,
})

describe('positionBands', () => {
  it('positions a single-day holiday at its fractional offset and width', () => {
    const [band] = positionBands([holiday('2026-06-08', '2026-06-08')], WINDOW)

    expect(band.leftFraction).toBeCloseTo(0.5, 5) // day 7 of 14
    expect(band.widthFraction).toBeCloseTo(1 / 14, 5)
    expect(band.kind).toBe('holiday')
    expect(band.summary).toBe('Holiday')
  })

  it('clips a band that starts before the window to the visible portion', () => {
    // 2026-05-30 .. 2026-06-02, but the window opens 2026-06-01.
    const [band] = positionBands([holiday('2026-05-30', '2026-06-02')], WINDOW)

    expect(band.leftFraction).toBe(0)
    expect(band.widthFraction).toBeCloseTo(2 / 14, 5) // only Jun 1–2 are inside
  })

  it('clips a band that runs past the window end', () => {
    // 2026-06-14 .. 2026-06-20, window closes 2026-06-15.
    const [band] = positionBands([holiday('2026-06-14', '2026-06-20')], WINDOW)

    expect(band.leftFraction).toBeCloseTo(13 / 14, 5)
    expect(band.leftFraction + band.widthFraction).toBeCloseTo(1, 5)
  })

  it('excludes a band entirely outside the window', () => {
    expect(positionBands([holiday('2026-07-01', '2026-07-02')], WINDOW)).toEqual([])
  })
})
