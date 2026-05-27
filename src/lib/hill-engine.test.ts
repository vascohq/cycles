import { describe, it, expect } from 'vitest'
import { progressToPoint, pointToProgress, clampHillProgress } from './hill-engine'

describe('progressToPoint', () => {
  it('maps 0 to the left end of the hill', () => {
    const pt = progressToPoint(0)
    expect(pt.x).toBeCloseTo(0, 0)
    expect(pt.y).toBeGreaterThan(80)
  })

  it('maps 1 to the right end of the hill', () => {
    const pt = progressToPoint(1)
    expect(pt.x).toBeGreaterThan(380)
    expect(pt.y).toBeGreaterThan(80)
  })

  it('maps 0.5 to the hilltop (highest point)', () => {
    const pt = progressToPoint(0.5)
    const left = progressToPoint(0)
    const right = progressToPoint(1)
    expect(pt.y).toBeLessThan(left.y)
    expect(pt.y).toBeLessThan(right.y)
  })
})

describe('pointToProgress round-trip', () => {
  it.each([0.1, 0.25, 0.5, 0.75, 0.9])(
    'round-trips progress %f with error < 0.01',
    (progress) => {
      const pt = progressToPoint(progress)
      const recovered = pointToProgress(pt.x)
      expect(Math.abs(recovered - progress)).toBeLessThan(0.01)
    }
  )
})

describe('clampHillProgress', () => {
  it('clamps 0 to 0.02', () => {
    expect(clampHillProgress(0)).toBe(0.02)
  })

  it('clamps 1 to 0.98', () => {
    expect(clampHillProgress(1)).toBe(0.98)
  })

  it('passes through 0.5 unchanged', () => {
    expect(clampHillProgress(0.5)).toBe(0.5)
  })
})
