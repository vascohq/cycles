import { describe, it, expect } from 'vitest'
import {
  FRAME_KINDS,
  FRAME_TYPES,
  KIND_COLORS,
  isFrameKind,
  isFrameType,
  renderProductMap,
} from './product-map-engine'
import type { Frame } from '@/product-map-liveblocks.config'

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'f1',
    kind: 'pain_point',
    type: 'bug',
    problem: 'Imports fail silently',
    appetite: '',
    business_case: '',
    reports: [],
    pointers: [],
    last_woken: '2026-09-01',
    resolved: false,
    ...overrides,
  }
}

describe('the Kind and Type vocabularies', () => {
  it('names the three Kinds', () => {
    expect([...FRAME_KINDS]).toEqual(['brand_burn', 'pain_point', 'unlock_win'])
  })

  it('names the five Types', () => {
    expect([...FRAME_TYPES]).toEqual(['bug', 'idea', 'request', 'security', 'irritant'])
  })

  it('gives every Kind its own color, so no two Kinds read alike', () => {
    const colors = FRAME_KINDS.map((k) => KIND_COLORS[k])
    expect(new Set(colors).size).toBe(FRAME_KINDS.length)
  })

  it('recognizes a valid Kind and refuses anything else', () => {
    expect(isFrameKind('brand_burn')).toBe(true)
    expect(isFrameKind('severity')).toBe(false)
    expect(isFrameKind(undefined)).toBe(false)
  })

  it('recognizes a valid Type and refuses anything else', () => {
    expect(isFrameType('security')).toBe(true)
    expect(isFrameType('feature')).toBe(false)
    expect(isFrameType('')).toBe(false)
  })
})

describe('renderProductMap', () => {
  it('returns one pin per frame', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.frameId)).toEqual(['f1', 'f2'])
  })

  it('gives an empty map no pins', () => {
    expect(renderProductMap({ frames: [], today: '2026-09-02' }).pins).toEqual([])
  })

  it("takes a pin's color from the frame's Kind", () => {
    const model = renderProductMap({
      frames: [
        makeFrame({ id: 'burn', kind: 'brand_burn' }),
        makeFrame({ id: 'pain', kind: 'pain_point' }),
        makeFrame({ id: 'win', kind: 'unlock_win' }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.color)).toEqual([
      KIND_COLORS.brand_burn,
      KIND_COLORS.pain_point,
      KIND_COLORS.unlock_win,
    ])
  })

  // Type is routing, not decoration. It rides on the model for the frame detail
  // and the filters, and it never reaches a pin channel (ADR 0025).
  it('carries the Type through without giving it a visual channel', () => {
    const model = renderProductMap({
      frames: [
        makeFrame({ id: 'a', type: 'bug', kind: 'pain_point' }),
        makeFrame({ id: 'b', type: 'security', kind: 'pain_point' }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.type)).toEqual(['bug', 'security'])
    expect(model.pins[0].color).toBe(model.pins[1].color)
  })

  it('falls back to pain_point when a stored Kind is unreadable', () => {
    const model = renderProductMap({
      frames: [makeFrame({ kind: 'catastrophe' as never })],
      today: '2026-09-02',
    })
    expect(model.pins[0].kind).toBe('pain_point')
    expect(model.pins[0].color).toBe(KIND_COLORS.pain_point)
  })

  it('leaves an Unmapped frame with no area', () => {
    const model = renderProductMap({ frames: [makeFrame()], today: '2026-09-02' })
    expect(model.pins[0].areaId).toBe('')
  })

  // Resolve is the only way off the map, and only a person does it (ADR 0025).
  it('drops a resolved frame from the map', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'open' }), makeFrame({ id: 'gone', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.frameId)).toEqual(['open'])
  })

  describe('daysSinceWoken', () => {
    // Today is a parameter, the same way the cycle list engine takes it. The
    // engine holds no clock, so a test never has to freeze one.
    it('counts whole days from the last wake to today', () => {
      const model = renderProductMap({
        frames: [makeFrame({ last_woken: '2026-08-20' })],
        today: '2026-09-02',
      })
      expect(model.pins[0].daysSinceWoken).toBe(13)
    })

    it('is zero on the day the frame was woken', () => {
      const model = renderProductMap({
        frames: [makeFrame({ last_woken: '2026-09-02' })],
        today: '2026-09-02',
      })
      expect(model.pins[0].daysSinceWoken).toBe(0)
    })

    it('is null for a frame that was never woken', () => {
      const model = renderProductMap({
        frames: [makeFrame({ last_woken: '' })],
        today: '2026-09-02',
      })
      expect(model.pins[0].daysSinceWoken).toBeNull()
    })
  })
})
