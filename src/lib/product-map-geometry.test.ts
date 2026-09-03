import { describe, expect, it } from 'vitest'

import {
  centroid,
  generateRing,
  hash,
  inRing,
  pinPosition,
  ringBounds,
  smoothPath,
  unionBounds,
  type Ring,
} from './product-map-geometry'

const SQUARE: Ring = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
]

const LUMPY: Ring = [
  [30, 80],
  [55, 40],
  [105, 25],
  [160, 32],
  [205, 60],
  [215, 105],
  [195, 150],
  [145, 172],
  [90, 168],
  [48, 145],
  [25, 115],
]

describe('smoothPath', () => {
  it('closes the ring', () => {
    expect(smoothPath(SQUARE).endsWith(' Z')).toBe(true)
  })

  it('emits one curve per point, so the coastline passes through all of them', () => {
    const curves = smoothPath(LUMPY).match(/ C /g) ?? []
    expect(curves).toHaveLength(LUMPY.length)
  })

  it('has no path at all for no points', () => {
    expect(smoothPath([])).toBe('')
  })

  it('draws a straight segment when there is no ring to smooth', () => {
    expect(smoothPath([[0, 0]])).toBe('M 0 0')
    expect(smoothPath([[0, 0], [10, 5]])).toBe('M 0 0 L 10 5')
  })
})

describe('ringBounds', () => {
  it('is the tightest box round the points', () => {
    expect(ringBounds(SQUARE)).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('has no box for no points', () => {
    expect(ringBounds([])).toBeNull()
  })
})

describe('unionBounds', () => {
  it('covers every box', () => {
    expect(
      unionBounds([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 50, y: 20, width: 10, height: 30 },
      ])
    ).toEqual({ x: 0, y: 0, width: 60, height: 50 })
  })

  it('has no box for no boxes', () => {
    expect(unionBounds([])).toBeNull()
  })
})

describe('centroid', () => {
  it('is the middle of a square', () => {
    expect(centroid(SQUARE)).toEqual([50, 50])
  })

  it('sits inside a lumpy coastline, which is the whole point of a label', () => {
    expect(inRing(centroid(LUMPY), LUMPY)).toBe(true)
  })

  it('falls back to the box centre for a ring with no area', () => {
    expect(
      centroid([
        [0, 0],
        [10, 0],
        [20, 0],
      ])
    ).toEqual([10, 0])
  })
})

describe('inRing', () => {
  it('finds a point inside', () => {
    expect(inRing([50, 50], SQUARE)).toBe(true)
  })

  it('finds a point outside', () => {
    expect(inRing([150, 50], SQUARE)).toBe(false)
  })

  it('treats a line as holding nothing', () => {
    expect(inRing([5, 0], [[0, 0], [10, 0]])).toBe(false)
  })
})

describe('hash', () => {
  it('is stable for the same text', () => {
    expect(hash('frame-a')).toBe(hash('frame-a'))
  })

  it('differs for different text', () => {
    expect(hash('frame-a')).not.toBe(hash('frame-b'))
  })
})

describe('pinPosition', () => {
  it('puts the pin inside its area', () => {
    for (const id of ['a', 'b', 'c', 'frame-42', 'nHq9', 'x'.repeat(30)]) {
      expect(inRing(pinPosition(id, LUMPY), LUMPY)).toBe(true)
    }
  })

  it('is the same spot every time, so a pin never wanders', () => {
    expect(pinPosition('frame-a', LUMPY)).toEqual(pinPosition('frame-a', LUMPY))
  })

  it('depends on the frame id alone, so capturing a frame never moves the others', () => {
    // No list, no index, no count is passed in — there is nothing else it could
    // depend on. This guards the signature as much as the result.
    const before = pinPosition('frame-a', LUMPY)
    const unrelated = pinPosition('frame-b', LUMPY)
    expect(pinPosition('frame-a', LUMPY)).toEqual(before)
    expect(unrelated).not.toEqual(before)
  })

  it('separates two frames', () => {
    expect(pinPosition('frame-a', LUMPY)).not.toEqual(pinPosition('frame-b', LUMPY))
  })

  it('falls back to the centroid when there is no area to sit in', () => {
    expect(pinPosition('frame-a', [[5, 5]])).toEqual([5, 5])
  })
})

describe('generateRing', () => {
  it('draws the same coastline for the same area every time', () => {
    expect(generateRing('area-1', 100, 100, 50)).toEqual(generateRing('area-1', 100, 100, 50))
  })

  it('draws a different coastline for a different area', () => {
    expect(generateRing('area-1', 100, 100, 50)).not.toEqual(
      generateRing('area-2', 100, 100, 50)
    )
  })

  it('stays near the radius it was asked for, so areas keep their grid spacing', () => {
    for (const [x, y] of generateRing('area-1', 100, 100, 50)) {
      const distance = Math.hypot(x - 100, y - 100)
      expect(distance).toBeGreaterThan(50 * 0.7)
      expect(distance).toBeLessThan(50 * 1.25)
    }
  })

  it('holds its own centroid, so the label lands on the land', () => {
    const ring = generateRing('area-1', 100, 100, 50)
    expect(inRing(centroid(ring), ring)).toBe(true)
  })
})
