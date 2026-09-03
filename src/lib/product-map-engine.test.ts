import { describe, it, expect } from 'vitest'
import {
  AREA_GAP,
  FRAME_KINDS,
  FRAME_TYPES,
  KIND_COLORS,
  candidateStatement,
  frameState,
  isFrameKind,
  isFrameType,
  isSharp,
  renderProductMap,
  type LinkedShape,
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

function makeShape(overrides: Partial<LinkedShape> = {}): LinkedShape {
  return {
    frameId: 'f1',
    shapeId: 's1',
    title: 'Silent import failures',
    stage: 'building',
    cycleSlug: '2026-q3',
    cycleTitle: 'Q3',
    currentCycle: true,
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

describe('sharp', () => {
  it('is true only when the frame has both a problem and an appetite', () => {
    expect(isSharp(makeFrame({ problem: 'Imports fail', appetite: '2 weeks' }))).toBe(true)
  })

  it('is false for a problem with no appetite', () => {
    expect(isSharp(makeFrame({ problem: 'Imports fail', appetite: '' }))).toBe(false)
  })

  it('is false for an appetite with no problem', () => {
    expect(isSharp(makeFrame({ problem: '', appetite: '2 weeks' }))).toBe(false)
  })

  it('is false for whitespace, so a stray space never sharpens a frame', () => {
    expect(isSharp(makeFrame({ problem: 'Imports fail', appetite: '   ' }))).toBe(false)
  })
})

describe('the candidate statement', () => {
  it('is built from the appetite, so nobody types it', () => {
    expect(candidateStatement(makeFrame({ appetite: '6 weeks' }))).toBe(
      'If we can shape this into something doable in 6 weeks, that is meaningful to us.'
    )
  })

  it('is absent for a rough frame: there is no commitment to state yet', () => {
    expect(candidateStatement(makeFrame({ appetite: '' }))).toBeNull()
  })
})

describe('frame state', () => {
  it('reads rough with no appetite', () => {
    expect(frameState(makeFrame({ appetite: '' }))).toBe('rough')
  })

  it('reads candidate when sharp with no shape yet', () => {
    expect(frameState(makeFrame({ appetite: '2 weeks' }), [])).toBe('candidate')
  })

  it('reads in_flight while a linked shape is not done', () => {
    const frame = makeFrame({ appetite: '2 weeks' })
    expect(frameState(frame, [makeShape({ stage: 'shaping' })])).toBe('in_flight')
    expect(frameState(frame, [makeShape({ stage: 'building' })])).toBe('in_flight')
  })

  it('reads released once the shape is done in the current cycle', () => {
    const frame = makeFrame({ appetite: '2 weeks' })
    expect(frameState(frame, [makeShape({ stage: 'done', currentCycle: true })])).toBe(
      'released'
    )
  })

  it('reads monitoring once the release is behind us, and never ends by itself', () => {
    const frame = makeFrame({ appetite: '2 weeks' })
    expect(frameState(frame, [makeShape({ stage: 'done', currentCycle: false })])).toBe(
      'monitoring'
    )
  })

  it('reads in_flight when a new shape attacks a frame released years ago', () => {
    const frame = makeFrame({ appetite: '2 weeks' })
    const shapes = [
      makeShape({ shapeId: 's1', stage: 'done', currentCycle: false, cycleSlug: '2024-q1' }),
      makeShape({ shapeId: 's2', stage: 'shaping', currentCycle: true }),
    ]
    expect(frameState(frame, shapes)).toBe('in_flight')
  })

  it('reads resolved whatever the shapes say, because a person decided', () => {
    const frame = makeFrame({ appetite: '2 weeks', resolved: true })
    expect(frameState(frame, [makeShape({ stage: 'building' })])).toBe('resolved')
    expect(frameState(makeFrame({ appetite: '', resolved: true }))).toBe('resolved')
  })
})

describe('the rendered pin carries the derived frame fields', () => {
  it('marks a sharp frame sharp and hands over its candidate statement', () => {
    const model = renderProductMap({
      frames: [makeFrame({ appetite: '6 weeks', business_case: 'Two customers churned' })],
      today: '2026-09-02',
    })
    expect(model.pins[0].sharp).toBe(true)
    expect(model.pins[0].state).toBe('candidate')
    expect(model.pins[0].candidateStatement).toContain('6 weeks')
    expect(model.pins[0].appetite).toBe('6 weeks')
    expect(model.pins[0].businessCase).toBe('Two customers churned')
  })

  it('marks a raw capture rough, so it never reads as agreed work', () => {
    const model = renderProductMap({ frames: [makeFrame()], today: '2026-09-02' })
    expect(model.pins[0].sharp).toBe(false)
    expect(model.pins[0].state).toBe('rough')
    expect(model.pins[0].candidateStatement).toBeNull()
  })

  it('reads the shapes of that frame only, never a neighbour frame shapes', () => {
    const model = renderProductMap({
      frames: [
        makeFrame({ id: 'f1', appetite: '2 weeks' }),
        makeFrame({ id: 'f2', appetite: '2 weeks' }),
      ],
      shapes: [makeShape({ frameId: 'f1', stage: 'building' })],
      today: '2026-09-02',
    })
    expect(model.pins[0].state).toBe('in_flight')
    expect(model.pins[1].state).toBe('candidate')
  })

  it('reports no owner as null rather than an empty string', () => {
    const model = renderProductMap({ frames: [makeFrame()], today: '2026-09-02' })
    expect(model.pins[0].owner).toBeNull()
  })
})
