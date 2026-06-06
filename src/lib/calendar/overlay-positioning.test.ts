import { describe, it, expect } from 'vitest'
import { positionBands } from './overlay-positioning'
import type { OverlayBand } from './ics-normalizer'

// 2026-06-01 (Mon) .. 2026-06-15 (Mon) = 10 BUSINESS days (two Mon–Fri weeks),
// matching the timebox/cycle-window tape, which plots business days (ADR 0013).
const WINDOW = { start: '2026-06-01', end: '2026-06-15' }

const holiday = (startDate: string, endDate: string, summary = 'Holiday'): OverlayBand => ({
  kind: 'holiday',
  label: 'Canada',
  summary,
  startDate,
  endDate,
})

describe('positionBands', () => {
  it('positions a single-day holiday on its business-day cell', () => {
    // Mon Jun 8 is the 6th business day (index 5) of 10.
    const [band] = positionBands([holiday('2026-06-08', '2026-06-08')], WINDOW)

    expect(band.leftFraction).toBeCloseTo(0.5, 5)
    expect(band.widthFraction).toBeCloseTo(0.1, 5)
    expect(band.kind).toBe('holiday')
    expect(band.summary).toBe('Holiday')
  })

  it('clips a band that starts before the window to the visible portion', () => {
    // Sat May 30 .. Tue Jun 2; window opens Jun 1. Visible business days: Jun 1–2.
    const [band] = positionBands([holiday('2026-05-30', '2026-06-02')], WINDOW)

    expect(band.leftFraction).toBe(0)
    expect(band.widthFraction).toBeCloseTo(0.2, 5) // 2 of 10 business days
  })

  it('clips a band that runs past the window end', () => {
    // Thu Jun 11 .. Sat Jun 20; window closes Jun 15. Jun 11 is business day 9.
    const [band] = positionBands([holiday('2026-06-11', '2026-06-20')], WINDOW)

    expect(band.leftFraction).toBeCloseTo(0.8, 5)
    expect(band.leftFraction + band.widthFraction).toBeCloseTo(1, 5)
  })

  it('drops a purely-weekend band (no business days to occupy)', () => {
    // Sat Jun 6 carries zero business-day width on the tape.
    expect(positionBands([holiday('2026-06-06', '2026-06-06')], WINDOW)).toEqual([])
  })

  it('excludes a band entirely outside the window', () => {
    expect(positionBands([holiday('2026-07-01', '2026-07-02')], WINDOW)).toEqual([])
  })
})
