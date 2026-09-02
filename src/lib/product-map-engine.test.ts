import { describe, it, expect } from 'vitest'
import {
  AREA_GAP,
  FRAME_KINDS,
  FRAME_TYPES,
  KIND_COLORS,
  isFrameKind,
  isFrameType,
  renderProductMap,
} from './product-map-engine'
import type { Area, Frame } from '@/product-map-liveblocks.config'

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

// ── Areas ──

function makeArea(overrides: Partial<Area> = {}): Area {
  return { id: 'a1', name: 'Integrations', x: 0, y: 0, ...overrides }
}

describe('area grouping', () => {
  it('groups each frame under the area it is filed in', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', name: 'Integrations' }), makeArea({ id: 'a2', name: 'Billing' })],
      frames: [
        makeFrame({ id: 'f1', areaId: 'a1' }),
        makeFrame({ id: 'f2', areaId: 'a2' }),
        makeFrame({ id: 'f3', areaId: 'a1' }),
      ],
      today: '2026-09-02',
    })
    expect(model.areas.map((a) => a.name)).toEqual(['Integrations', 'Billing'])
    expect(model.areas[0].pins.map((p) => p.frameId)).toEqual(['f1', 'f3'])
    expect(model.areas[1].pins.map((p) => p.frameId)).toEqual(['f2'])
  })

  it('keeps an area with no frames, because an empty area is still land', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas).toHaveLength(1)
    expect(model.areas[0].pins).toEqual([])
  })

  it('carries the area owner through, as a default and nothing more', () => {
    const model = renderProductMap({
      areas: [makeArea({ owner: 'user_9' }), makeArea({ id: 'a2', name: 'Billing' })],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].owner).toBe('user_9')
    expect(model.areas[1].owner).toBeNull()
  })

  // Rejected on purpose: it makes the individual pins unreadable.
  it('never gives an area a color of its own', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      frames: [makeFrame({ areaId: 'a1', kind: 'brand_burn' })],
      today: '2026-09-02',
    })
    expect(Object.keys(model.areas[0])).not.toContain('color')
  })

  it('leaves a resolved frame off its area', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      frames: [
        makeFrame({ id: 'open', areaId: 'a1' }),
        makeFrame({ id: 'gone', areaId: 'a1', resolved: true }),
      ],
      today: '2026-09-02',
    })
    expect(model.areas[0].pins.map((p) => p.frameId)).toEqual(['open'])
  })
})

describe('the Unmapped group', () => {
  it('collects the frames that belong to no area', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      frames: [makeFrame({ id: 'filed', areaId: 'a1' }), makeFrame({ id: 'homeless' })],
      today: '2026-09-02',
    })
    expect(model.unmapped.map((p) => p.frameId)).toEqual(['homeless'])
  })

  // A dangling area id is not a home. Unmapped is always a valid result, so the
  // frame stays visible rather than disappearing with the area that held it.
  it('collects a frame whose area no longer exists', () => {
    const model = renderProductMap({
      areas: [],
      frames: [makeFrame({ id: 'orphan', areaId: 'deleted' })],
      today: '2026-09-02',
    })
    expect(model.unmapped.map((p) => p.frameId)).toEqual(['orphan'])
  })

  it('is empty when every frame is filed', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      frames: [makeFrame({ areaId: 'a1' })],
      today: '2026-09-02',
    })
    expect(model.unmapped).toEqual([])
  })
})

describe('sub-areas', () => {
  it('nests a sub-area under its parent, and off the top level', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', name: 'Integrations' }),
        makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'a1' }),
      ],
      frames: [makeFrame({ id: 'f1', areaId: 'a2' })],
      today: '2026-09-02',
    })
    expect(model.areas.map((a) => a.name)).toEqual(['Integrations'])
    expect(model.areas[0].children.map((a) => a.name)).toEqual(['HubSpot'])
    expect(model.areas[0].children[0].pins.map((p) => p.frameId)).toEqual(['f1'])
    // The frames of a sub-area belong to the sub-area, not to the parent.
    expect(model.areas[0].pins).toEqual([])
  })

  it('nests a sub-area of a sub-area', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', name: 'Integrations' }),
        makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'a1' }),
        makeArea({ id: 'a3', name: 'Deals sync', parentAreaId: 'a2' }),
      ],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].children[0].children.map((a) => a.name)).toEqual(['Deals sync'])
  })

  it('promotes an area whose parent no longer exists, rather than losing it', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'deleted' })],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas.map((a) => a.name)).toEqual(['HubSpot'])
  })

  // Storage can hold anything, including a parent loop. The map still draws.
  it('draws every area even when the parent chain loops', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', name: 'One', parentAreaId: 'a2' }),
        makeArea({ id: 'a2', name: 'Two', parentAreaId: 'a1' }),
      ],
      frames: [],
      today: '2026-09-02',
    })
    const drawn = model.areas.flatMap((a) => [a.name, ...a.children.map((c) => c.name)])
    expect(drawn.sort()).toEqual(['One', 'Two'])
  })
})

describe("an area's generated shape", () => {
  // An agent must be able to create an area, and an agent cannot draw. So the
  // area carries a grid position and the app turns it into a shape.
  it('places the shape from the position, not from stored geometry', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', x: 0, y: 0 }), makeArea({ id: 'a2', x: 2, y: 1 })],
      frames: [],
      today: '2026-09-02',
    })
    const [first, second] = model.areas
    expect(first.shape.x).toBe(0)
    expect(first.shape.y).toBe(0)
    expect(second.shape.x).toBe(2 * (first.shape.width + AREA_GAP))
    expect(second.shape.y).toBe(1 * (first.shape.height + AREA_GAP))
  })

  it('gives two areas at the same position the same shape', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', x: 1, y: 1 }), makeArea({ id: 'a2', x: 1, y: 1 })],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].shape).toEqual(model.areas[1].shape)
  })

  it('draws a sub-area smaller than its parent', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1' }),
        makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'a1' }),
      ],
      frames: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].children[0].shape.width).toBeLessThan(model.areas[0].shape.width)
  })
})
