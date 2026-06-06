import { describe, it, expect } from 'vitest'
import {
  progressToPoint,
  pointToProgress,
  isHillProgressDone,
  shouldCelebrateCompletion,
} from './hill-engine'

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

describe('isHillProgressDone', () => {
  it('is done at exactly 1 (foot of the downhill)', () => {
    expect(isHillProgressDone(1)).toBe(true)
  })

  it('is not done at the last-but-one step (11/12)', () => {
    expect(isHillProgressDone(11 / 12)).toBe(false)
  })

  it('is not done partway down the hill', () => {
    expect(isHillProgressDone(0.5)).toBe(false)
    expect(isHillProgressDone(0)).toBe(false)
  })
})

describe('shouldCelebrateCompletion', () => {
  it('celebrates when a scope crosses into done (was below 1, now 1)', () => {
    expect(shouldCelebrateCompletion(11 / 12, 1)).toBe(true)
  })

  it('does not celebrate when the scope was already done', () => {
    expect(shouldCelebrateCompletion(1, 1)).toBe(false)
  })

  it('does not celebrate when the new position is not done', () => {
    expect(shouldCelebrateCompletion(0.5, 11 / 12)).toBe(false)
  })

  it('does not celebrate when a scope moves back off done', () => {
    expect(shouldCelebrateCompletion(1, 0.5)).toBe(false)
  })
})
