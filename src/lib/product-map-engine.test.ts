import { describe, it, expect } from 'vitest'
import {
  AREA_GAP,
  FRAME_KINDS,
  FRAME_TYPES,
  KIND_COLORS,
  DEFAULT_FRESHNESS,
  FALLBACK_CYCLE_DAYS,
  HEAT_LENSES,
  MIN_OPACITY,
  PLAYBOOKS,
  POINTER_KINDS,
  PIN_MAX_SIZE,
  PIN_MIN_SIZE,
  candidateStatement,
  clusterForViewport,
  frameState,
  cyclesSinceWoken,
  gapList,
  inCooldown,
  isPointerKind,
  linkedShapesFrom,
  originChain,
  pinOutline,
  pinOpacity,
  pinSize,
  reportCount,
  isFrameKind,
  isFrameType,
  isSharp,
  renderProductMap,
  type CycleWindow,
  type LinkedShape,
} from './product-map-engine'
import type {
  Area,
  Frame,
  FramePointer,
  FrameReport,
} from '@/product-map-liveblocks.config'

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
    outcomes: [],
    last_woken: '2026-09-01',
    resolved: false,
    ...overrides,
  }
}

/** Enough of an outcome to sharpen a frame. */
const OUTCOMES = [{ id: 'o1', text: 'A failed import tells the importer why' }]

function makeReport(overrides: Partial<FrameReport> = {}): FrameReport {
  return {
    capturer: 'user_1',
    source: 'internal',
    text: 'It happened again',
    date: '2026-09-01',
    ...overrides,
  }
}

/** Two six-week build cycles, back to back, then a cooldown. */
const CYCLES: CycleWindow[] = [
  { slug: 'c1', title: 'One', type: 'build', start_date: '2026-01-05', end_date: '2026-02-13' },
  { slug: 'c2', title: 'Two', type: 'build', start_date: '2026-02-16', end_date: '2026-03-27' },
  { slug: 'cool', title: 'Cooldown', type: 'cooldown', start_date: '2026-03-30', end_date: '2026-04-03' },
]

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

  // Resolve is the only way off the Product Map, and only a person does it (ADR 0025).
  it('drops a resolved frame from the Product Map', () => {
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

  // Storage can hold anything, including a parent loop. The Product Map still draws.
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
  it('is false with no outcome, so nobody bets on a frame that never says what changes', () => {
    expect(
      isSharp(makeFrame({ problem: 'Imports fail', appetite: '2 weeks', outcomes: [] }))
    ).toBe(false)
  })

  it('is true with a problem, an appetite and an outcome', () => {
    expect(
      isSharp(makeFrame({ problem: 'Imports fail', appetite: '2 weeks', outcomes: OUTCOMES }))
    ).toBe(true)
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
    expect(candidateStatement(makeFrame({ appetite: '6 weeks', outcomes: OUTCOMES }))).toBe(
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
    expect(frameState(makeFrame({ appetite: '2 weeks', outcomes: OUTCOMES }), [])).toBe('candidate')
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
      frames: [
        makeFrame({ appetite: '6 weeks', business_case: 'Two customers churned', outcomes: OUTCOMES }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins[0].sharp).toBe(true)
    expect(model.pins[0].state).toBe('candidate')
    expect(model.pins[0].candidateStatement).toContain('6 weeks')
    expect(model.pins[0].appetite).toBe('6 weeks')
    expect(model.pins[0].businessCase).toBe('Two customers churned')
  })

  it('hands over the stated outcomes, dropping the blank ones', () => {
    const model = renderProductMap({
      frames: [
        makeFrame({
          outcomes: [
            { id: 'o1', text: 'A failed import tells the importer why' },
            { id: 'o2', text: '   ' },
          ],
        }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins[0].outcomes).toEqual([
      { id: 'o1', text: 'A failed import tells the importer why' },
    ])
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
        makeFrame({ id: 'f1', appetite: '2 weeks', outcomes: OUTCOMES }),
        makeFrame({ id: 'f2', appetite: '2 weeks', outcomes: OUTCOMES }),
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

describe('the heat lens', () => {
  it('names the three lenses', () => {
    expect([...HEAT_LENSES]).toEqual(['all', 'internal', 'customer'])
  })

  const frame = makeFrame({
    reports: [
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'internal' }),
    ],
  })

  it('counts every report under the all lens', () => {
    expect(reportCount(frame, 'all')).toBe(4)
  })

  it('counts only what customers raised under the customer lens', () => {
    expect(reportCount(frame, 'customer')).toBe(3)
  })

  it('counts only what the team raised under the internal lens', () => {
    expect(reportCount(frame, 'internal')).toBe(1)
  })

  it('counts nothing on a frame nobody has reported', () => {
    expect(reportCount(makeFrame(), 'all')).toBe(0)
  })
})

describe('pin size', () => {
  it('draws the smallest pin for a frame with no reports', () => {
    expect(pinSize(0)).toBe(PIN_MIN_SIZE)
  })

  it('grows with the report count, so widespread pain looks bigger', () => {
    expect(pinSize(5)).toBeGreaterThan(pinSize(1))
    expect(pinSize(1)).toBeGreaterThan(pinSize(0))
  })

  it('caps, so one shouty frame never swallows its area', () => {
    expect(pinSize(500)).toBe(PIN_MAX_SIZE)
  })
})

describe('the rendered pin under each lens', () => {
  const hotWithCustomers = makeFrame({
    reports: [
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
    ],
  })

  it('draws a frame hot with customers and cold internally at two sizes', () => {
    const customerLens = renderProductMap({
      frames: [hotWithCustomers],
      lens: 'customer',
      today: '2026-09-02',
    })
    const internalLens = renderProductMap({
      frames: [hotWithCustomers],
      lens: 'internal',
      today: '2026-09-02',
    })
    expect(customerLens.pins[0].reportCount).toBe(4)
    expect(internalLens.pins[0].reportCount).toBe(0)
    expect(customerLens.pins[0].size).toBeGreaterThan(internalLens.pins[0].size)
  })

  it('counts every report when no lens is named', () => {
    const model = renderProductMap({ frames: [hotWithCustomers], today: '2026-09-02' })
    expect(model.pins[0].reportCount).toBe(4)
  })

  it('hands the detail every report, whatever the lens filters out', () => {
    const model = renderProductMap({
      frames: [hotWithCustomers],
      lens: 'internal',
      today: '2026-09-02',
    })
    expect(model.pins[0].reports).toHaveLength(4)
  })
})

describe('playbooks and the gap list', () => {
  function pointer(kind: FramePointer['kind']): FramePointer {
    return { url: 'https://example.test/1', label: 'x', kind }
  }

  it('gives every Type a playbook, so a Type with none would be a bug', () => {
    for (const type of FRAME_TYPES) {
      expect(PLAYBOOKS[type]).toBeDefined()
    }
  })

  it('expects less of a bug than of an idea, so a small fix carries no ceremony', () => {
    expect(PLAYBOOKS.bug.expects.length).toBeLessThan(PLAYBOOKS.idea.expects.length)
  })

  it('expects a pull request on a security frame', () => {
    expect(PLAYBOOKS.security.expects).toContain('pull_request')
  })

  it('names no pointer kind for a Shape, because a shape points at its frame', () => {
    expect(isPointerKind('shape')).toBe(false)
    expect([...POINTER_KINDS]).not.toContain('shape')
  })

  it('lists what the playbook expects and the frame lacks', () => {
    const frame = makeFrame({ type: 'bug', pointers: [pointer('issue')] })
    expect(gapList(frame)).toEqual(['pull_request'])
  })

  it('lists nothing once the frame points at everything expected', () => {
    const frame = makeFrame({
      type: 'bug',
      pointers: [pointer('issue'), pointer('pull_request')],
    })
    expect(gapList(frame)).toEqual([])
  })

  it('lists nothing for a Type whose playbook expects nothing', () => {
    expect(gapList(makeFrame({ type: 'irritant', pointers: [] }))).toEqual([])
  })

  it('ignores a pointer the playbook never asked for', () => {
    const frame = makeFrame({ type: 'irritant', pointers: [pointer('wayfinder')] })
    expect(gapList(frame)).toEqual([])
  })

  it('reads a frame stored before pointers existed as one full gap list', () => {
    const frame = makeFrame({ type: 'bug' })
    delete (frame as Partial<Frame>).pointers
    expect(gapList(frame)).toEqual(['issue', 'pull_request'])
  })

  it('hands the pin its pointers and its gaps', () => {
    const model = renderProductMap({
      frames: [makeFrame({ type: 'bug', pointers: [pointer('issue')] })],
      today: '2026-09-02',
    })
    expect(model.pins[0].pointers).toHaveLength(1)
    expect(model.pins[0].gaps).toEqual(['pull_request'])
  })
})

describe('counting cycles since the last wake', () => {
  it('counts nothing while the frame\'s own cycle is still running', () => {
    expect(cyclesSinceWoken('2026-01-20', CYCLES, '2026-02-01')).toBe(0)
  })

  it('counts one once that cycle has ended', () => {
    expect(cyclesSinceWoken('2026-01-20', CYCLES, '2026-03-01')).toBe(1)
  })

  it('counts two once a second cycle has ended', () => {
    expect(cyclesSinceWoken('2026-01-20', CYCLES, '2026-03-30')).toBe(2)
  })

  // Counting cycles rather than weeks is the whole point: state changes at a
  // moment when somebody is looking (ADR 0024).
  it('counts nothing for a team with no cycle, so nothing ages', () => {
    expect(cyclesSinceWoken('2020-01-01', [], '2026-09-02')).toBe(0)
  })

  it('ignores an undated cycle, because it has no boundary to cross', () => {
    const undated: CycleWindow[] = [
      { slug: 'x', title: 'Undated', type: 'build', start_date: '', end_date: '' },
    ]
    expect(cyclesSinceWoken('2026-01-20', undated, '2026-09-02')).toBe(0)
  })

  // A cooldown is its own room here, so counting it would put a frame to sleep
  // after one build cycle instead of two — half the window ADR 0024 asks for.
  it('does not age a frame for a cooldown, only for a build cycle', () => {
    // Woken in cycle two; today is after the cooldown that followed it.
    expect(cyclesSinceWoken('2026-03-01', CYCLES, '2026-04-10')).toBe(1)
  })
})

describe('pin opacity', () => {
  it('draws a frame woken today at full strength', () => {
    expect(pinOpacity(0, CYCLES, DEFAULT_FRESHNESS)).toBe(1)
  })

  it('fades as the clock runs, so a stale map looks stale', () => {
    const fresh = pinOpacity(7, CYCLES, DEFAULT_FRESHNESS)
    const stale = pinOpacity(60, CYCLES, DEFAULT_FRESHNESS)
    expect(stale).toBeLessThan(fresh)
    expect(fresh).toBeLessThan(1)
  })

  it('stops fading at a floor, so a faded pin is still findable', () => {
    expect(pinOpacity(5000, CYCLES, DEFAULT_FRESHNESS)).toBe(MIN_OPACITY)
  })

  it('falls back to a six-week cycle when the team has none', () => {
    const withCycles = pinOpacity(FALLBACK_CYCLE_DAYS, [], DEFAULT_FRESHNESS)
    expect(withCycles).toBeLessThan(1)
    expect(withCycles).toBeGreaterThan(MIN_OPACITY)
  })
})

describe('the dormant boundary', () => {
  function render(lastWoken: string, today: string, overrides = {}) {
    return renderProductMap({
      frames: [makeFrame({ last_woken: lastWoken })],
      cycles: CYCLES,
      today,
      ...overrides,
    })
  }

  it('keeps a frame on the Product Map after one cycle with no wake', () => {
    const model = render('2026-01-20', '2026-03-01')
    expect(model.pins).toHaveLength(1)
    expect(model.pins[0].dim).toBe(true)
    expect(model.pins[0].dormant).toBe(false)
  })

  it('takes a frame off the Product Map after two cycles with no wake', () => {
    const model = render('2026-01-20', '2026-03-30')
    expect(model.pins).toHaveLength(0)
    expect(model.unmapped).toHaveLength(0)
  })

  it('reads both thresholds from configuration, not from constants', () => {
    const model = render('2026-01-20', '2026-03-01', {
      freshness: { dimAfterCycles: 1, dormantAfterCycles: 1 },
    })
    expect(model.pins).toHaveLength(0)
  })

  // Sunk cost must never set priority (ADR 0024).
  it('lets past investment make no difference to the boundary', () => {
    const worked = renderProductMap({
      frames: [makeFrame({ last_woken: '2026-01-20', appetite: '2 weeks' })],
      shapes: [makeShape({ stage: 'done', currentCycle: false })],
      cycles: CYCLES,
      today: '2026-03-30',
    })
    expect(worked.pins).toHaveLength(0)
  })

  it('brings a frame back onto the Product Map when somebody wakes it', () => {
    const model = render('2026-03-29', '2026-03-30')
    expect(model.pins).toHaveLength(1)
  })

  it('ages nothing for a team with no cycle, so the Product Map works before the first one', () => {
    const model = renderProductMap({
      frames: [makeFrame({ last_woken: '2019-01-01' })],
      cycles: [],
      today: '2026-09-02',
    })
    expect(model.pins).toHaveLength(1)
    expect(model.pins[0].dormant).toBe(false)
  })
})

describe('the sweep', () => {
  const asleep = Array.from({ length: 15 }, (_, i) =>
    makeFrame({ id: `f${i}`, last_woken: '2026-01-20' })
  )

  it('runs at the end of a cycle, in cooldown, where somebody is looking', () => {
    const model = renderProductMap({
      frames: asleep,
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.dormantReview.length).toBeGreaterThan(0)
  })

  it('caps the review queue', () => {
    const model = renderProductMap({
      frames: asleep,
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.dormantReview).toHaveLength(DEFAULT_FRESHNESS.reviewQueueCap)
  })

  it('shows no queue mid-cycle, because the sweep is a cycle-end ritual', () => {
    const model = renderProductMap({
      frames: asleep,
      cycles: CYCLES,
      today: '2026-03-01',
    })
    expect(model.dormantReview).toEqual([])
  })

  it('knows when today sits in cooldown', () => {
    expect(inCooldown(CYCLES, '2026-03-31')).toBe(true)
    expect(inCooldown(CYCLES, '2026-03-01')).toBe(false)
    expect(inCooldown([], '2026-03-31')).toBe(false)
  })

  // Nothing is ever deleted on a timer: a dormant frame keeps everything.
  it('keeps every field and every report on a sleeping frame', () => {
    const model = renderProductMap({
      frames: [
        makeFrame({
          last_woken: '2026-01-20',
          appetite: '6 weeks',
          business_case: 'Two customers churned',
          reports: [makeReport()],
          pointers: [{ url: 'https://x.test', label: 'Issue', kind: 'issue' }],
        }),
      ],
      cycles: CYCLES,
      today: '2026-03-31',
    })
    const [sleeper] = model.dormantReview
    expect(sleeper.appetite).toBe('6 weeks')
    expect(sleeper.businessCase).toBe('Two customers churned')
    expect(sleeper.reports).toHaveLength(1)
    expect(sleeper.pointers).toHaveLength(1)
  })
})

describe('the engagement ring', () => {
  it('draws nothing when nobody is working on the frame', () => {
    expect(pinOutline([])).toBe('none')
  })

  it('draws dashed while a linked shape is being shaped', () => {
    expect(pinOutline([makeShape({ stage: 'shaping', currentCycle: false })])).toBe('dashed')
  })

  it('draws solid while a linked shape runs in the cycle happening now', () => {
    expect(pinOutline([makeShape({ stage: 'building', currentCycle: true })])).toBe('solid')
  })

  it('keeps the ring solid for a shape that shipped in the cycle happening now', () => {
    expect(pinOutline([makeShape({ stage: 'done', currentCycle: true })])).toBe('solid')
  })

  it('draws nothing once the work is done and its cycle is behind us', () => {
    expect(pinOutline([makeShape({ stage: 'done', currentCycle: false })])).toBe('none')
  })

  it('prefers the current cycle when a frame carries an old shape too', () => {
    const shapes = [
      makeShape({ shapeId: 's1', stage: 'shaping', currentCycle: false }),
      makeShape({ shapeId: 's2', stage: 'building', currentCycle: true }),
    ]
    expect(pinOutline(shapes)).toBe('solid')
  })
})

describe('reading the shapes out of the cycle rooms', () => {
  const cycle = CYCLES[1]

  it('keeps only the shapes that point at a frame', () => {
    const shapes = linkedShapesFrom(
      [
        {
          cycle,
          shapes: [
            { id: 's1', title: 'Fix imports', stage: 'building', frame_id: 'f1' },
            { id: 's2', title: 'Something else', stage: 'building' },
          ],
        },
      ],
      '2026-03-01'
    )
    expect(shapes.map((s) => s.shapeId)).toEqual(['s1'])
    expect(shapes[0].frameId).toBe('f1')
  })

  it('names the cycle, so the frame detail reads a title and not a slug', () => {
    const [shape] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'done', frame_id: 'f1' }] }],
      '2026-03-01'
    )
    expect(shape.cycleTitle).toBe('Two')
  })

  it('marks a shape in the cycle running today as current', () => {
    const [inside] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'building', frame_id: 'f1' }] }],
      '2026-03-01'
    )
    const [outside] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'building', frame_id: 'f1' }] }],
      '2026-09-02'
    )
    expect(inside.currentCycle).toBe(true)
    expect(outside.currentCycle).toBe(false)
  })

  // Stored data outlives the code that wrote it: a room written before ADR 0023
  // still holds `framing`, and losing the shape over it would be worse.
  it('reads a stored framing stage as shaping', () => {
    const [shape] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'framing', frame_id: 'f1' }] }],
      '2026-03-01'
    )
    expect(shape.stage).toBe('shaping')
  })
})

describe('a frame that has been bet on', () => {
  it('carries its shapes, its ring and its investment mark', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1', appetite: '6 weeks' })],
      shapes: [makeShape({ frameId: 'f1', stage: 'building', currentCycle: true })],
      today: '2026-09-02',
    })
    expect(model.pins[0].shapes).toHaveLength(1)
    expect(model.pins[0].outline).toBe('solid')
    expect(model.pins[0].worked).toBe(true)
    expect(model.pins[0].state).toBe('in_flight')
  })

  it('carries no mark and no ring when nobody has bet on it', () => {
    const model = renderProductMap({
      frames: [makeFrame({ appetite: '6 weeks' })],
      today: '2026-09-02',
    })
    expect(model.pins[0].worked).toBe(false)
    expect(model.pins[0].outline).toBe('none')
  })

  it('lists both bets when the same frame is attacked again later', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1', appetite: '6 weeks' })],
      shapes: [
        makeShape({ frameId: 'f1', shapeId: 's1', stage: 'done', cycleSlug: '2024-q1', currentCycle: false }),
        makeShape({ frameId: 'f1', shapeId: 's2', stage: 'shaping', currentCycle: true }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins[0].shapes.map((s) => s.cycleSlug)).toEqual(['2024-q1', '2026-q3'])
  })
})

describe('monitoring', () => {
  const released = makeShape({ stage: 'done', currentCycle: false })

  it('has no end condition: a released frame stays there until a person acts', () => {
    const frame = makeFrame({ appetite: '6 weeks' })
    expect(frameState(frame, [released])).toBe('monitoring')
    // Years later, nothing has moved it on by itself.
    expect(frameState(frame, [released])).toBe('monitoring')
  })

  it('ends only when a person resolves the frame', () => {
    const frame = makeFrame({ appetite: '6 weeks', resolved: true })
    expect(frameState(frame, [released])).toBe('resolved')
  })

  // A quiet release leaves the Product Map quietly (ADR 0024).
  it('keeps the dormancy clock running, so a quiet release goes to sleep', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1', appetite: '6 weeks', last_woken: '2026-01-20' })],
      shapes: [makeShape({ frameId: 'f1', stage: 'done', currentCycle: false })],
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.pins).toHaveLength(0)
    expect(model.dormantReview).toHaveLength(1)
  })
})

describe('the origin chain', () => {
  const origin = makeFrame({ id: 'f1', problem: 'Imports fail silently' })
  const followOn = makeFrame({
    id: 'f2',
    problem: 'The new importer is too slow',
    originFrameId: 'f1',
  })

  it('names the frame whose monitoring surfaced this one', () => {
    expect(originChain(followOn, [origin, followOn])).toEqual([
      { frameId: 'f1', problem: 'Imports fail silently' },
    ])
  })

  it('is empty for a frame nothing surfaced', () => {
    expect(originChain(origin, [origin, followOn])).toEqual([])
  })

  it('walks two links back, nearest first', () => {
    const third = makeFrame({ id: 'f3', problem: 'Nobody uses the new importer', originFrameId: 'f2' })
    expect(originChain(third, [origin, followOn, third]).map((l) => l.frameId)).toEqual([
      'f2',
      'f1',
    ])
  })

  it('stops at a missing origin rather than throwing', () => {
    const orphan = makeFrame({ id: 'f9', originFrameId: 'gone' })
    expect(originChain(orphan, [orphan])).toEqual([])
  })

  it('stops on a chain that loops, so bad data cannot hang the Product Map', () => {
    const a = makeFrame({ id: 'a', originFrameId: 'b' })
    const b = makeFrame({ id: 'b', originFrameId: 'a' })
    expect(originChain(a, [a, b]).map((l) => l.frameId)).toEqual(['b'])
  })

  // Creating the follow-on frame never reopens the origin (ADR 0025).
  it('leaves the origin frame in monitoring', () => {
    const model = renderProductMap({
      frames: [{ ...origin, appetite: '6 weeks' }, followOn],
      shapes: [makeShape({ frameId: 'f1', stage: 'done', currentCycle: false })],
      today: '2026-09-02',
    })
    const [first, second] = model.pins
    expect(first.state).toBe('monitoring')
    expect(second.originChain[0].frameId).toBe('f1')
  })
})

describe('a resolved frame', () => {
  const area = makeArea({ id: 'a1' })

  it('leaves the Product Map view', () => {
    const model = renderProductMap({
      areas: [area],
      frames: [makeFrame({ id: 'f1', areaId: 'a1', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.pins).toEqual([])
    expect(model.areas[0].pins).toEqual([])
    expect(model.unmapped).toEqual([])
  })

  it('stays on its area, with the shapes that resolved it', () => {
    const model = renderProductMap({
      areas: [area],
      frames: [makeFrame({ id: 'f1', areaId: 'a1', appetite: '6 weeks', resolved: true })],
      shapes: [makeShape({ frameId: 'f1', stage: 'done', currentCycle: false })],
      today: '2026-09-02',
    })
    expect(model.areas[0].resolved).toHaveLength(1)
    expect(model.areas[0].resolved[0].shapes[0].title).toBe('Silent import failures')
    expect(model.resolved).toHaveLength(1)
  })

  it('is never deleted, so it stays readable even with no area', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.resolved).toHaveLength(1)
    expect(model.unmapped).toEqual([])
    // Unmapped is a home like any other, so the record stays reachable there.
    expect(model.unmappedResolved).toHaveLength(1)
  })

  it('never lands in the dormant review, because it is not asleep', () => {
    const model = renderProductMap({
      frames: [makeFrame({ id: 'f1', resolved: true, last_woken: '2026-01-20' })],
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.dormantReview).toEqual([])
  })
})

const ISLAND: [number, number][] = [
  [0, 0],
  [200, 0],
  [200, 200],
  [0, 200],
]

describe('area coastlines', () => {
  it('uses the outline an agent drew', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: ISLAND })],
      frames: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring).toEqual(ISLAND)
    expect(model.areas[0].path).toContain('C')
    expect(model.areas[0].path.endsWith(' Z')).toBe(true)
  })

  it('generates one for an area nobody has drawn, so old land still renders', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: undefined })],
      frames: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring.length).toBeGreaterThanOrEqual(3)
    expect(model.areas[0].path).not.toBe('')
  })

  it('falls back rather than drawing a sliver from a truncated outline', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: [[0, 0], [10, 10]] })],
      frames: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring.length).toBeGreaterThanOrEqual(3)
  })

  it('puts the label inside the coastline', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: ISLAND })],
      frames: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].labelAt).toEqual([100, 100])
  })

  it('widens an area box to hold its children, because the zoom ladder measures it', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', outline: ISLAND }),
        makeArea({
          id: 'a2',
          parentAreaId: 'a1',
          outline: [
            [300, 300],
            [400, 300],
            [400, 400],
          ],
        }),
      ],
      frames: [],
      today: '2026-09-03',
    })
    // The container's own outline is deliberately ignored: an island's coastline
    // is the silhouette of its children, so its box is theirs.
    expect(model.areas[0].bounds).toEqual({ x: 300, y: 300, width: 100, height: 100 })
    expect(model.areas[0].ring).toEqual([])
    expect(model.areas[0].path).toBe('')
  })

  it('names a container just above its coastline, where no pin can sit on the label', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', name: 'Front office' }),
        makeArea({
          id: 'a2',
          parentAreaId: 'a1',
          outline: [
            [100, 100],
            [200, 100],
            [200, 200],
            [100, 200],
          ],
        }),
      ],
      frames: [],
      today: '2026-09-03',
    })
    const [, labelY] = model.areas[0].labelAt
    expect(model.areas[0].labelAt[0]).toBe(150)
    expect(labelY).toBeLessThan(100)
  })
})

describe('area levels', () => {
  it('reads a leaf as an area, its parent as an island, and the grandparent as an archipelago', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'arch', name: 'Front office' }),
        makeArea({ id: 'isle', name: 'Owned by Vasco', parentAreaId: 'arch' }),
        makeArea({ id: 'leaf', name: 'Dashboards', parentAreaId: 'isle' }),
      ],
      frames: [],
      today: '2026-09-03',
    })
    const arch = model.areas[0]
    expect(arch.level).toBe('archipelago')
    expect(arch.children[0].level).toBe('island')
    expect(arch.children[0].children[0].level).toBe('area')
  })

  it('reads a lone area with no children as an area', () => {
    const model = renderProductMap({ areas: [makeArea()], frames: [], today: '2026-09-03' })
    expect(model.areas[0].level).toBe('area')
  })
})

describe('pin placement', () => {
  it('puts every pin inside the area it is filed in', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [
        makeFrame({ id: 'f1', areaId: 'a1' }),
        makeFrame({ id: 'f2', areaId: 'a1' }),
        makeFrame({ id: 'f3', areaId: 'a1' }),
      ],
      today: '2026-09-03',
    })
    for (const pin of model.areas[0].pins) {
      expect(pin.at).not.toBeNull()
      const [x, y] = pin.at!
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(200)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(200)
    }
  })

  it('leaves an Unmapped frame with no position, because it lives in the tray', () => {
    const model = renderProductMap({
      areas: [],
      frames: [makeFrame({ id: 'f1' })],
      today: '2026-09-03',
    })
    expect(model.unmapped[0].at).toBeNull()
  })

  it('never moves a pin when another frame is captured', () => {
    const args = { areas: [makeArea({ id: 'a1', outline: ISLAND })], today: '2026-09-03' }
    const before = renderProductMap({ ...args, frames: [makeFrame({ id: 'f1', areaId: 'a1' })] })
    const after = renderProductMap({
      ...args,
      frames: [
        makeFrame({ id: 'f0', areaId: 'a1' }),
        makeFrame({ id: 'f1', areaId: 'a1' }),
        makeFrame({ id: 'f2', areaId: 'a1' }),
      ],
    })
    const moved = after.pins.find((p) => p.frameId === 'f1')!
    expect(moved.at).toEqual(before.pins[0].at)
  })

  it('agrees between the flat pin list and the area tree', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [makeFrame({ id: 'f1', areaId: 'a1' })],
      today: '2026-09-03',
    })
    expect(model.pins[0].at).toEqual(model.areas[0].pins[0].at)
  })
})

describe('the zoom ladder', () => {
  const archipelago = () =>
    renderProductMap({
      areas: [
        makeArea({ id: 'arch', name: 'Front office', outline: ISLAND }),
        makeArea({
          id: 'isle',
          name: 'Owned by Vasco',
          parentAreaId: 'arch',
          outline: [
            [10, 10],
            [90, 10],
            [90, 90],
            [10, 90],
          ],
        }),
        makeArea({
          id: 'leaf',
          name: 'Dashboards',
          parentAreaId: 'isle',
          outline: [
            [20, 20],
            [60, 20],
            [60, 60],
            [20, 60],
          ],
        }),
      ],
      frames: [
        makeFrame({ id: 'f1', areaId: 'leaf', kind: 'pain_point' }),
        makeFrame({ id: 'f2', areaId: 'isle', kind: 'brand_burn' }),
      ],
      today: '2026-09-03',
    })

  it('collapses a small archipelago into one bubble', () => {
    const nodes = clusterForViewport(archipelago().areas, 0.1)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].kind).toBe('bubble')
  })

  it('counts every frame underneath the bubble, however deep', () => {
    const [node] = clusterForViewport(archipelago().areas, 0.1)
    expect(node.kind === 'bubble' && node.count).toBe(2)
  })

  it('numbers frames, never reports', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [
        makeFrame({
          id: 'f1',
          areaId: 'a1',
          reports: [makeReport(), makeReport(), makeReport()],
        }),
        makeFrame({ id: 'f2', areaId: 'a1', reports: [makeReport(), makeReport()] }),
      ],
      today: '2026-09-03',
    })
    const [node] = clusterForViewport(model.areas, 0.1)
    expect(node.kind === 'bubble' && node.count).toBe(2)
  })

  it('takes the worst Kind it holds, not an average', () => {
    const [node] = clusterForViewport(archipelago().areas, 0.1)
    expect(node.kind === 'bubble' && node.color).toBe(KIND_COLORS.brand_burn)
  })

  it('opens up as the map gets bigger on screen', () => {
    const areas = archipelago().areas
    const zoomedOut = clusterForViewport(areas, 0.1)
    const zoomedIn = clusterForViewport(areas, 8)
    expect(zoomedOut).toHaveLength(1)
    expect(zoomedIn.every((n) => n.kind === 'area')).toBe(true)
    expect(zoomedIn).toHaveLength(3)
  })

  it('judges each child on its own size, so one big area does not open a tiny sibling', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'parent', name: 'Parent' }),
        makeArea({ id: 'big', name: 'Big', parentAreaId: 'parent', outline: ISLAND }),
        makeArea({
          id: 'small',
          name: 'Small',
          parentAreaId: 'parent',
          outline: [
            [205, 5],
            [215, 5],
            [215, 15],
          ],
        }),
      ],
      frames: [
        makeFrame({ id: 'f1', areaId: 'small' }),
        makeFrame({ id: 'f2', areaId: 'small' }),
        makeFrame({ id: 'f3', areaId: 'big' }),
        makeFrame({ id: 'f4', areaId: 'big' }),
      ],
      today: '2026-09-03',
    })
    // The parent spans 215 units and opens; inside it the 200-unit child opens
    // and the 10-unit child does not.
    const nodes = clusterForViewport(model.areas, 1.5)
    expect(nodes.map((n) => n.kind)).toEqual(['area', 'area', 'bubble'])
  })

  it('takes an outline when ANY frame inside has work on it', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [makeFrame({ id: 'f1', areaId: 'a1' }), makeFrame({ id: 'f2', areaId: 'a1' })],
      shapes: [
        {
          frameId: 'f2',
          shapeId: 's1',
          title: 'Fix imports',
          stage: 'building',
          cycleSlug: 'c1',
          cycleTitle: 'Cycle 1',
          currentCycle: true,
        },
      ],
      today: '2026-09-03',
    })
    const [node] = clusterForViewport(model.areas, 0.1)
    expect(node.kind === 'bubble' && node.outline).toBe('solid')
  })

  it('takes its opacity from the freshest frame inside, never the mean', () => {
    const cycles: CycleWindow[] = [
      { slug: 'c1', title: 'Cycle 1', type: 'build', start_date: '2026-01-01', end_date: '2026-02-11' },
      { slug: 'c2', title: 'Cycle 2', type: 'build', start_date: '2026-02-12', end_date: '2026-03-25' },
      { slug: 'c3', title: 'Cycle 3', type: 'build', start_date: '2026-03-26', end_date: '2026-05-06' },
    ]
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [
        // Dim, not dormant: a dormant frame leaves the map and would not count.
        makeFrame({ id: 'stale', areaId: 'a1', last_woken: '2026-02-20' }),
        makeFrame({ id: 'fresh', areaId: 'a1', last_woken: '2026-05-01' }),
        makeFrame({ id: 'fresh2', areaId: 'a1', last_woken: '2026-05-02' }),
      ],
      cycles,
      today: '2026-05-06',
    })
    const stale = model.pins.find((p) => p.frameId === 'stale')!
    const freshest = Math.max(...model.pins.map((p) => p.opacity))
    const [node] = clusterForViewport(model.areas, 0.1)
    expect(node.kind === 'bubble' && node.opacity).toBe(freshest)
    // The mean would have dragged it down towards the stale one.
    expect(freshest).toBeGreaterThan(stale.opacity)
  })

  // A bubble reading "1" hides a pin behind a number and says nothing extra, and
  // a pin holds its size on screen however far out the map is zoomed.
  it('shows the pin rather than a bubble reading one', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [makeFrame({ id: 'f1', areaId: 'a1' })],
      today: '2026-09-03',
    })
    const nodes = clusterForViewport(model.areas, 0.1)
    expect(nodes.map((n) => n.kind)).toEqual(['area'])
  })

  it('never bubbles an empty area', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      frames: [],
      today: '2026-09-03',
    })
    const nodes = clusterForViewport(model.areas, 0.1)
    expect(nodes.map((n) => n.kind)).toEqual(['area'])
  })

  it('draws nothing when there is no land', () => {
    expect(clusterForViewport([], 1)).toEqual([])
  })
})

describe('the heat lens on the land', () => {
  const AREA_RING: [number, number][] = [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ]

  function mapWith(lens: 'all' | 'internal' | 'customer') {
    return renderProductMap({
      areas: [makeArea({ id: 'a1', outline: AREA_RING })],
      frames: [
        makeFrame({
          id: 'internal-only',
          areaId: 'a1',
          reports: [makeReport({ source: 'internal' })],
        }),
        makeFrame({
          id: 'customer-1',
          areaId: 'a1',
          reports: [makeReport({ source: 'customer', customer: 'Northwind' })],
        }),
        makeFrame({
          id: 'customer-2',
          areaId: 'a1',
          reports: [makeReport({ source: 'customer', customer: 'Contoso' })],
        }),
      ],
      lens,
      today: '2026-09-03',
    })
  }

  it('lets everything through under the everyone lens', () => {
    expect(mapWith('all').pins.every((p) => p.passesLens)).toBe(true)
  })

  it('keeps a frame nobody has reported yet, so a fresh capture never vanishes', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: AREA_RING })],
      frames: [makeFrame({ id: 'f1', areaId: 'a1', reports: [] })],
      lens: 'all',
      today: '2026-09-03',
    })
    expect(model.pins[0].passesLens).toBe(true)
  })

  it('drops a frame only the team raised, under the customer lens', () => {
    const passing = mapWith('customer').pins.filter((p) => p.passesLens).map((p) => p.frameId)
    expect(passing).toEqual(['customer-1', 'customer-2'])
  })

  it('shrinks the bubble to what customers actually raised', () => {
    const everyone = clusterForViewport(mapWith('all').areas, 0.1)
    const customers = clusterForViewport(mapWith('customer').areas, 0.1)
    expect(everyone[0].kind === 'bubble' && everyone[0].count).toBe(3)
    expect(customers[0].kind === 'bubble' && customers[0].count).toBe(2)
  })

  it('drops the customer frames under the internal lens', () => {
    const internal = clusterForViewport(mapWith('internal').areas, 0.1)
    // One frame left, so it draws as a pin rather than a bubble reading "1".
    expect(internal.map((n) => n.kind)).toEqual(['area'])
  })
})
