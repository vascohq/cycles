import { describe, it, expect } from 'vitest'
import {
  relateRequests,
  relatedRequests,
  withReportIds,
  AREA_GAP,
  REQUEST_KINDS,
  REQUEST_TYPES,
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
  requestState,
  seedPitchFrame,
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
  isRequestKind,
  isRequestType,
  isSharp,
  renderRequest,
  renderProductMap,
  type CycleWindow,
  type LinkedShape,
} from './product-map-engine'
import type {
  Area,
  ProductRequest,
  RequestPointer,
  RequestReport,
} from '@/product-map-liveblocks.config'

function makeRequest(overrides: Partial<ProductRequest> = {}): ProductRequest {
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

/** Enough of an outcome to sharpen a request. */
const OUTCOMES = [{ id: 'o1', text: 'A failed import tells the importer why' }]

function makeReport(overrides: Partial<RequestReport> = {}): RequestReport {
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
    requestId: 'f1',
    shapeId: 's1',
    title: 'Silent import failures',
    stage: 'building',
    cycleSlug: '2026-q3',
    cycleTitle: 'Q3',
    currentCycle: true,
    upcomingCycle: false,
    ...overrides,
  }
}

describe('the Kind and Type vocabularies', () => {
  it('names the three Kinds', () => {
    expect([...REQUEST_KINDS]).toEqual(['brand_burn', 'pain_point', 'unlock_win'])
  })

  it('names the five Types', () => {
    expect([...REQUEST_TYPES]).toEqual(['bug', 'idea', 'ask', 'security', 'irritant'])
  })

  it('gives every Kind its own color, so no two Kinds read alike', () => {
    const colors = REQUEST_KINDS.map((k) => KIND_COLORS[k])
    expect(new Set(colors).size).toBe(REQUEST_KINDS.length)
  })

  it('recognizes a valid Kind and refuses anything else', () => {
    expect(isRequestKind('brand_burn')).toBe(true)
    expect(isRequestKind('severity')).toBe(false)
    expect(isRequestKind(undefined)).toBe(false)
  })

  it('recognizes a valid Type and refuses anything else', () => {
    expect(isRequestType('security')).toBe(true)
    expect(isRequestType('feature')).toBe(false)
    expect(isRequestType('')).toBe(false)
  })
})

describe('renderProductMap', () => {
  it('returns one pin per request', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1' }), makeRequest({ id: 'f2' })],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.requestId)).toEqual(['f1', 'f2'])
  })

  it('gives an empty map no pins', () => {
    expect(renderProductMap({ requests: [], today: '2026-09-02' }).pins).toEqual([])
  })

  it("takes a pin's color from the request's Kind", () => {
    const model = renderProductMap({
      requests: [
        makeRequest({ id: 'burn', kind: 'brand_burn' }),
        makeRequest({ id: 'pain', kind: 'pain_point' }),
        makeRequest({ id: 'win', kind: 'unlock_win' }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.color)).toEqual([
      KIND_COLORS.brand_burn,
      KIND_COLORS.pain_point,
      KIND_COLORS.unlock_win,
    ])
  })

  // Type is routing, not decoration. It rides on the model for the request detail
  // and the filters, and it never reaches a pin channel (ADR 0025).
  it('carries the Type through without giving it a visual channel', () => {
    const model = renderProductMap({
      requests: [
        makeRequest({ id: 'a', type: 'bug', kind: 'pain_point' }),
        makeRequest({ id: 'b', type: 'security', kind: 'pain_point' }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.type)).toEqual(['bug', 'security'])
    expect(model.pins[0].color).toBe(model.pins[1].color)
  })

  it('falls back to pain_point when a stored Kind is unreadable', () => {
    const model = renderProductMap({
      requests: [makeRequest({ kind: 'catastrophe' as never })],
      today: '2026-09-02',
    })
    expect(model.pins[0].kind).toBe('pain_point')
    expect(model.pins[0].color).toBe(KIND_COLORS.pain_point)
  })

  it('leaves an Unmapped request with no area', () => {
    const model = renderProductMap({ requests: [makeRequest()], today: '2026-09-02' })
    expect(model.pins[0].areaId).toBe('')
  })

  // Resolve is the only way off the Product Map, and only a person does it (ADR 0025).
  it('drops a resolved request from the Product Map', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'open' }), makeRequest({ id: 'gone', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.pins.map((p) => p.requestId)).toEqual(['open'])
  })

  describe('daysSinceWoken', () => {
    // Today is a parameter, the same way the cycle list engine takes it. The
    // engine holds no clock, so a test never has to freeze one.
    it('counts whole days from the last wake to today', () => {
      const model = renderProductMap({
        requests: [makeRequest({ last_woken: '2026-08-20' })],
        today: '2026-09-02',
      })
      expect(model.pins[0].daysSinceWoken).toBe(13)
    })

    it('is zero on the day the request was woken', () => {
      const model = renderProductMap({
        requests: [makeRequest({ last_woken: '2026-09-02' })],
        today: '2026-09-02',
      })
      expect(model.pins[0].daysSinceWoken).toBe(0)
    })

    it('is null for a request that was never woken', () => {
      const model = renderProductMap({
        requests: [makeRequest({ last_woken: '' })],
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
  it('groups each request under the area it is filed in', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', name: 'Integrations' }), makeArea({ id: 'a2', name: 'Billing' })],
      requests: [
        makeRequest({ id: 'f1', areaId: 'a1' }),
        makeRequest({ id: 'f2', areaId: 'a2' }),
        makeRequest({ id: 'f3', areaId: 'a1' }),
      ],
      today: '2026-09-02',
    })
    expect(model.areas.map((a) => a.name)).toEqual(['Integrations', 'Billing'])
    expect(model.areas[0].pins.map((p) => p.requestId)).toEqual(['f1', 'f3'])
    expect(model.areas[1].pins.map((p) => p.requestId)).toEqual(['f2'])
  })

  it('keeps an area with no requests, because an empty area is still land', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      requests: [],
      today: '2026-09-02',
    })
    expect(model.areas).toHaveLength(1)
    expect(model.areas[0].pins).toEqual([])
  })

  it('carries the area owner through, as a default and nothing more', () => {
    const model = renderProductMap({
      areas: [makeArea({ owner: 'user_9' }), makeArea({ id: 'a2', name: 'Billing' })],
      requests: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].owner).toBe('user_9')
    expect(model.areas[1].owner).toBeNull()
  })

  // Rejected on purpose: it makes the individual pins unreadable.
  it('never gives an area a color of its own', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      requests: [makeRequest({ areaId: 'a1', kind: 'brand_burn' })],
      today: '2026-09-02',
    })
    expect(Object.keys(model.areas[0])).not.toContain('color')
  })

  it('leaves a resolved request off its area', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      requests: [
        makeRequest({ id: 'open', areaId: 'a1' }),
        makeRequest({ id: 'gone', areaId: 'a1', resolved: true }),
      ],
      today: '2026-09-02',
    })
    expect(model.areas[0].pins.map((p) => p.requestId)).toEqual(['open'])
  })
})

describe('the Unmapped group', () => {
  it('collects the requests that belong to no area', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      requests: [makeRequest({ id: 'filed', areaId: 'a1' }), makeRequest({ id: 'homeless' })],
      today: '2026-09-02',
    })
    expect(model.unmapped.map((p) => p.requestId)).toEqual(['homeless'])
  })

  // A dangling area id is not a home. Unmapped is always a valid result, so the
  // request stays visible rather than disappearing with the area that held it.
  it('collects a request whose area no longer exists', () => {
    const model = renderProductMap({
      areas: [],
      requests: [makeRequest({ id: 'orphan', areaId: 'deleted' })],
      today: '2026-09-02',
    })
    expect(model.unmapped.map((p) => p.requestId)).toEqual(['orphan'])
  })

  it('is empty when every request is filed', () => {
    const model = renderProductMap({
      areas: [makeArea()],
      requests: [makeRequest({ areaId: 'a1' })],
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
      requests: [makeRequest({ id: 'f1', areaId: 'a2' })],
      today: '2026-09-02',
    })
    expect(model.areas.map((a) => a.name)).toEqual(['Integrations'])
    expect(model.areas[0].children.map((a) => a.name)).toEqual(['HubSpot'])
    expect(model.areas[0].children[0].pins.map((p) => p.requestId)).toEqual(['f1'])
    // The requests of a sub-area belong to the sub-area, not to the parent.
    expect(model.areas[0].pins).toEqual([])
  })

  it('nests a sub-area of a sub-area', () => {
    const model = renderProductMap({
      areas: [
        makeArea({ id: 'a1', name: 'Integrations' }),
        makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'a1' }),
        makeArea({ id: 'a3', name: 'Deals sync', parentAreaId: 'a2' }),
      ],
      requests: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].children[0].children.map((a) => a.name)).toEqual(['Deals sync'])
  })

  it('promotes an area whose parent no longer exists, rather than losing it', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a2', name: 'HubSpot', parentAreaId: 'deleted' })],
      requests: [],
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
      requests: [],
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
      requests: [],
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
      requests: [],
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
      requests: [],
      today: '2026-09-02',
    })
    expect(model.areas[0].children[0].shape.width).toBeLessThan(model.areas[0].shape.width)
  })
})

describe('sharp', () => {
  it('is false with no outcome, so nobody bets on a request that never says what changes', () => {
    expect(
      isSharp(makeRequest({ problem: 'Imports fail', appetite: '2 weeks', outcomes: [] }))
    ).toBe(false)
  })

  it('is true with a problem, an appetite and an outcome', () => {
    expect(
      isSharp(makeRequest({ problem: 'Imports fail', appetite: '2 weeks', outcomes: OUTCOMES }))
    ).toBe(true)
  })

  it('is false for a problem with no appetite', () => {
    expect(isSharp(makeRequest({ problem: 'Imports fail', appetite: '' }))).toBe(false)
  })

  it('is false for an appetite with no problem', () => {
    expect(isSharp(makeRequest({ problem: '', appetite: '2 weeks' }))).toBe(false)
  })

  it('is false for whitespace, so a stray space never sharpens a request', () => {
    expect(isSharp(makeRequest({ problem: 'Imports fail', appetite: '   ' }))).toBe(false)
  })
})

describe('the candidate statement', () => {
  it('is built from the appetite, so nobody types it', () => {
    expect(candidateStatement(makeRequest({ appetite: '6 weeks', outcomes: OUTCOMES }))).toBe(
      'If we can shape this into something doable in 6 weeks, that is meaningful to us.'
    )
  })

  it('is absent for a rough request: there is no commitment to state yet', () => {
    expect(candidateStatement(makeRequest({ appetite: '' }))).toBeNull()
  })
})

describe('request state', () => {
  it('reads rough with no appetite', () => {
    expect(requestState(makeRequest({ appetite: '' }))).toBe('rough')
  })

  it('reads candidate when sharp with no shape yet', () => {
    expect(requestState(makeRequest({ appetite: '2 weeks', outcomes: OUTCOMES }), [])).toBe('candidate')
  })

  it('reads in_flight while a linked shape is not done', () => {
    const request = makeRequest({ appetite: '2 weeks' })
    expect(requestState(request, [makeShape({ stage: 'shaping' })])).toBe('in_flight')
    expect(requestState(request, [makeShape({ stage: 'building' })])).toBe('in_flight')
  })

  it('reads released once the shape is done in the current cycle', () => {
    const request = makeRequest({ appetite: '2 weeks' })
    expect(requestState(request, [makeShape({ stage: 'done', currentCycle: true })])).toBe(
      'released'
    )
  })

  it('reads monitoring once the release is behind us, and never ends by itself', () => {
    const request = makeRequest({ appetite: '2 weeks' })
    expect(requestState(request, [makeShape({ stage: 'done', currentCycle: false })])).toBe(
      'monitoring'
    )
  })

  it('reads in_flight when a new shape attacks a request released years ago', () => {
    const request = makeRequest({ appetite: '2 weeks' })
    const shapes = [
      makeShape({ shapeId: 's1', stage: 'done', currentCycle: false, cycleSlug: '2024-q1' }),
      makeShape({ shapeId: 's2', stage: 'shaping', currentCycle: true }),
    ]
    expect(requestState(request, shapes)).toBe('in_flight')
  })

  it('reads pitched while its only pitch waits in an upcoming cycle', () => {
    const request = makeRequest({ appetite: '2 weeks', outcomes: OUTCOMES })
    const pitch = makeShape({ stage: 'framing', currentCycle: false, upcomingCycle: true })
    expect(requestState(request, [pitch])).toBe('pitched')
  })

  it('reads resolved whatever the shapes say, because a person decided', () => {
    const request = makeRequest({ appetite: '2 weeks', resolved: true })
    expect(requestState(request, [makeShape({ stage: 'building' })])).toBe('resolved')
    expect(requestState(makeRequest({ appetite: '', resolved: true }))).toBe('resolved')
  })
})

describe('the rendered pin carries the derived request fields', () => {
  it('marks a sharp request sharp and hands over its candidate statement', () => {
    const model = renderProductMap({
      requests: [
        makeRequest({ appetite: '6 weeks', business_case: 'Two customers churned', outcomes: OUTCOMES }),
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
      requests: [
        makeRequest({
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
    const model = renderProductMap({ requests: [makeRequest()], today: '2026-09-02' })
    expect(model.pins[0].sharp).toBe(false)
    expect(model.pins[0].state).toBe('rough')
    expect(model.pins[0].candidateStatement).toBeNull()
  })

  it('reads the shapes of that request only, never a neighbour request shapes', () => {
    const model = renderProductMap({
      requests: [
        makeRequest({ id: 'f1', appetite: '2 weeks', outcomes: OUTCOMES }),
        makeRequest({ id: 'f2', appetite: '2 weeks', outcomes: OUTCOMES }),
      ],
      shapes: [makeShape({ requestId: 'f1', stage: 'building' })],
      today: '2026-09-02',
    })
    expect(model.pins[0].state).toBe('in_flight')
    expect(model.pins[1].state).toBe('candidate')
  })

  it('reports no owner as null rather than an empty string', () => {
    const model = renderProductMap({ requests: [makeRequest()], today: '2026-09-02' })
    expect(model.pins[0].owner).toBeNull()
  })
})

describe('the heat lens', () => {
  it('names the three lenses', () => {
    expect([...HEAT_LENSES]).toEqual(['all', 'internal', 'customer'])
  })

  const request = makeRequest({
    reports: [
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'internal' }),
    ],
  })

  it('counts every report under the all lens', () => {
    expect(reportCount(request, 'all')).toBe(4)
  })

  it('counts only what customers raised under the customer lens', () => {
    expect(reportCount(request, 'customer')).toBe(3)
  })

  it('counts only what the team raised under the internal lens', () => {
    expect(reportCount(request, 'internal')).toBe(1)
  })

  it('counts nothing on a request nobody has reported', () => {
    expect(reportCount(makeRequest(), 'all')).toBe(0)
  })
})

describe('pin size', () => {
  it('draws the smallest pin for a request with no reports', () => {
    expect(pinSize(0)).toBe(PIN_MIN_SIZE)
  })

  it('grows with the report count, so widespread pain looks bigger', () => {
    expect(pinSize(5)).toBeGreaterThan(pinSize(1))
    expect(pinSize(1)).toBeGreaterThan(pinSize(0))
  })

  it('caps, so one shouty request never swallows its area', () => {
    expect(pinSize(500)).toBe(PIN_MAX_SIZE)
  })
})

describe('the rendered pin under each lens', () => {
  const hotWithCustomers = makeRequest({
    reports: [
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
      makeReport({ source: 'customer' }),
    ],
  })

  it('draws a request hot with customers and cold internally at two sizes', () => {
    const customerLens = renderProductMap({
      requests: [hotWithCustomers],
      lens: 'customer',
      today: '2026-09-02',
    })
    const internalLens = renderProductMap({
      requests: [hotWithCustomers],
      lens: 'internal',
      today: '2026-09-02',
    })
    expect(customerLens.pins[0].reportCount).toBe(4)
    expect(internalLens.pins[0].reportCount).toBe(0)
    expect(customerLens.pins[0].size).toBeGreaterThan(internalLens.pins[0].size)
  })

  it('counts every report when no lens is named', () => {
    const model = renderProductMap({ requests: [hotWithCustomers], today: '2026-09-02' })
    expect(model.pins[0].reportCount).toBe(4)
  })

  it('hands the detail every report, whatever the lens filters out', () => {
    const model = renderProductMap({
      requests: [hotWithCustomers],
      lens: 'internal',
      today: '2026-09-02',
    })
    expect(model.pins[0].reports).toHaveLength(4)
  })
})

describe('playbooks and the gap list', () => {
  function pointer(kind: RequestPointer['kind']): RequestPointer {
    return { url: 'https://example.test/1', label: 'x', kind }
  }

  it('gives every Type a playbook, so a Type with none would be a bug', () => {
    for (const type of REQUEST_TYPES) {
      expect(PLAYBOOKS[type]).toBeDefined()
    }
  })

  it('expects less of a bug than of an idea, so a small fix carries no ceremony', () => {
    expect(PLAYBOOKS.bug.expects.length).toBeLessThan(PLAYBOOKS.idea.expects.length)
  })

  it('expects a pull request on a security request', () => {
    expect(PLAYBOOKS.security.expects).toContain('pull_request')
  })

  it('names no pointer kind for a Shape, because a shape points at its request', () => {
    expect(isPointerKind('shape')).toBe(false)
    expect([...POINTER_KINDS]).not.toContain('shape')
  })

  it('lists what the playbook expects and the request lacks', () => {
    const request = makeRequest({ type: 'bug', pointers: [pointer('issue')] })
    expect(gapList(request)).toEqual(['pull_request'])
  })

  it('lists nothing once the request points at everything expected', () => {
    const request = makeRequest({
      type: 'bug',
      pointers: [pointer('issue'), pointer('pull_request')],
    })
    expect(gapList(request)).toEqual([])
  })

  it('lists nothing for a Type whose playbook expects nothing', () => {
    expect(gapList(makeRequest({ type: 'irritant', pointers: [] }))).toEqual([])
  })

  it('ignores a pointer the playbook never asked for', () => {
    const request = makeRequest({ type: 'irritant', pointers: [pointer('wayfinder')] })
    expect(gapList(request)).toEqual([])
  })

  it('reads a request stored before pointers existed as one full gap list', () => {
    const request = makeRequest({ type: 'bug' })
    delete (request as Partial<ProductRequest>).pointers
    expect(gapList(request)).toEqual(['issue', 'pull_request'])
  })

  it('hands the pin its pointers and its gaps', () => {
    const model = renderProductMap({
      requests: [makeRequest({ type: 'bug', pointers: [pointer('issue')] })],
      today: '2026-09-02',
    })
    expect(model.pins[0].pointers).toHaveLength(1)
    expect(model.pins[0].gaps).toEqual(['pull_request'])
  })
})

describe('counting cycles since the last wake', () => {
  it('counts nothing while the request\'s own cycle is still running', () => {
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

  // A cooldown is its own room here, so counting it would put a request to sleep
  // after one build cycle instead of two — half the window ADR 0024 asks for.
  it('does not age a request for a cooldown, only for a build cycle', () => {
    // Woken in cycle two; today is after the cooldown that followed it.
    expect(cyclesSinceWoken('2026-03-01', CYCLES, '2026-04-10')).toBe(1)
  })
})

describe('pin opacity', () => {
  it('draws a request woken today at full strength', () => {
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
      requests: [makeRequest({ last_woken: lastWoken })],
      cycles: CYCLES,
      today,
      ...overrides,
    })
  }

  it('keeps a request on the Product Map after one cycle with no wake', () => {
    const model = render('2026-01-20', '2026-03-01')
    expect(model.pins).toHaveLength(1)
    expect(model.pins[0].dim).toBe(true)
    expect(model.pins[0].dormant).toBe(false)
  })

  it('takes a request off the Product Map after two cycles with no wake', () => {
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
      requests: [makeRequest({ last_woken: '2026-01-20', appetite: '2 weeks' })],
      shapes: [makeShape({ stage: 'done', currentCycle: false })],
      cycles: CYCLES,
      today: '2026-03-30',
    })
    expect(worked.pins).toHaveLength(0)
  })

  it('brings a request back onto the Product Map when somebody wakes it', () => {
    const model = render('2026-03-29', '2026-03-30')
    expect(model.pins).toHaveLength(1)
  })

  it('ages nothing for a team with no cycle, so the Product Map works before the first one', () => {
    const model = renderProductMap({
      requests: [makeRequest({ last_woken: '2019-01-01' })],
      cycles: [],
      today: '2026-09-02',
    })
    expect(model.pins).toHaveLength(1)
    expect(model.pins[0].dormant).toBe(false)
  })
})

describe('the sweep', () => {
  const asleep = Array.from({ length: 15 }, (_, i) =>
    makeRequest({ id: `f${i}`, last_woken: '2026-01-20' })
  )

  it('runs at the end of a cycle, in cooldown, where somebody is looking', () => {
    const model = renderProductMap({
      requests: asleep,
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.dormantReview.length).toBeGreaterThan(0)
  })

  it('caps the review queue', () => {
    const model = renderProductMap({
      requests: asleep,
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.dormantReview).toHaveLength(DEFAULT_FRESHNESS.reviewQueueCap)
  })

  it('shows no queue mid-cycle, because the sweep is a cycle-end ritual', () => {
    const model = renderProductMap({
      requests: asleep,
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

  // Nothing is ever deleted on a timer: a dormant request keeps everything.
  it('keeps every field and every report on a sleeping request', () => {
    const model = renderProductMap({
      requests: [
        makeRequest({
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
  it('draws nothing when nobody is working on the request', () => {
    expect(pinOutline([])).toBe('none')
  })

  it('draws dashed while a linked shape is being shaped', () => {
    expect(pinOutline([makeShape({ stage: 'shaping', currentCycle: false })])).toBe('dashed')
    expect(pinOutline([makeShape({ stage: 'framing', currentCycle: false, upcomingCycle: true })])).toBe('dashed')
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

  it('prefers the current cycle when a request carries an old shape too', () => {
    const shapes = [
      makeShape({ shapeId: 's1', stage: 'shaping', currentCycle: false }),
      makeShape({ shapeId: 's2', stage: 'building', currentCycle: true }),
    ]
    expect(pinOutline(shapes)).toBe('solid')
  })
})

describe('reading the shapes out of the cycle rooms', () => {
  const cycle = CYCLES[1]

  it('carries the release summary, so the request shows what shipped for it', () => {
    const [shipped, silent] = linkedShapesFrom(
      [
        {
          cycle,
          shapes: [
            { id: 's1', title: 'a', stage: 'done', request_ids: ['f1'], release_summary: 'Exports finish.' },
            { id: 's2', title: 'b', stage: 'done', request_ids: ['f1'] },
          ],
        },
      ],
      '2026-03-01'
    )
    expect(shipped.releaseSummary).toBe('Exports finish.')
    expect(silent.releaseSummary).toBeUndefined()
  })

  it('links a pitch to every request it carries', () => {
    const shapes = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'Fast exports', stage: 'framing', request_ids: ['f1', 'f2'] }] }],
      '2026-03-01'
    )
    expect(shapes.map((s) => [s.shapeId, s.requestId])).toEqual([
      ['s1', 'f1'],
      ['s1', 'f2'],
    ])
  })

  it('keeps only the shapes that point at a request', () => {
    const shapes = linkedShapesFrom(
      [
        {
          cycle,
          shapes: [
            { id: 's1', title: 'Fix imports', stage: 'building', request_ids: ['f1'] },
            { id: 's2', title: 'Something else', stage: 'building' },
          ],
        },
      ],
      '2026-03-01'
    )
    expect(shapes.map((s) => s.shapeId)).toEqual(['s1'])
    expect(shapes[0].requestId).toBe('f1')
  })

  // The request page names who is on it and links the pitch. Both live on the
  // shape in its cycle room, never on the request.
  it('carries the squad and the Notion pitch, and drops a squad that is gone', () => {
    const shapes = linkedShapesFrom(
      [
        {
          cycle,
          squads: [{ id: 'q1', name: 'Capture', color: '#8e4ec6' }],
          shapes: [
            { id: 's1', title: 'a', stage: 'building', request_ids: ['f1'], squadId: 'q1', notion_url: 'https://notion.so/p' },
            { id: 's2', title: 'b', stage: 'building', request_ids: ['f1'], squadId: 'gone', notion_url: '' },
          ],
        },
      ],
      '2026-03-01'
    )
    expect(shapes[0].squad).toEqual({ name: 'Capture', color: '#8e4ec6' })
    expect(shapes[0].notionUrl).toBe('https://notion.so/p')
    expect(shapes[1].squad).toBeUndefined()
    expect(shapes[1].notionUrl).toBeUndefined()
  })

  it('names the cycle, so the request detail reads a title and not a slug', () => {
    const [shape] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'done', request_ids: ['f1'] }] }],
      '2026-03-01'
    )
    expect(shape.cycleTitle).toBe('Two')
  })

  it('marks a pitch in a cycle that has not started as upcoming, and keeps it framing', () => {
    const [waiting] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'framing', request_ids: ['f1'] }] }],
      '2026-02-01'
    )
    const [running] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'framing', request_ids: ['f1'] }] }],
      '2026-03-01'
    )
    expect(waiting.upcomingCycle).toBe(true)
    expect(waiting.stage).toBe('framing')
    expect(running.upcomingCycle).toBe(false)
  })

  it('marks a shape in the cycle running today as current', () => {
    const [inside] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'building', request_ids: ['f1'] }] }],
      '2026-03-01'
    )
    const [outside] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'building', request_ids: ['f1'] }] }],
      '2026-09-02'
    )
    expect(inside.currentCycle).toBe(true)
    expect(outside.currentCycle).toBe(false)
  })

  // Stored data outlives the code that wrote it, and losing the pitch over an
  // unreadable stage would be worse.
  it('reads an unknown stage as shaping', () => {
    const [shape] = linkedShapesFrom(
      [{ cycle, shapes: [{ id: 's1', title: 'x', stage: 'pondering', request_ids: ['f1'] }] }],
      '2026-03-01'
    )
    expect(shape.stage).toBe('shaping')
  })
})

describe('a request that has been bet on', () => {
  it('carries its shapes, its ring and its investment mark', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1', appetite: '6 weeks' })],
      shapes: [makeShape({ requestId: 'f1', stage: 'building', currentCycle: true })],
      today: '2026-09-02',
    })
    expect(model.pins[0].shapes).toHaveLength(1)
    expect(model.pins[0].outline).toBe('solid')
    expect(model.pins[0].worked).toBe(true)
    expect(model.pins[0].state).toBe('in_flight')
  })

  it('carries no mark and no ring when nobody has bet on it', () => {
    const model = renderProductMap({
      requests: [makeRequest({ appetite: '6 weeks' })],
      today: '2026-09-02',
    })
    expect(model.pins[0].worked).toBe(false)
    expect(model.pins[0].outline).toBe('none')
  })

  it('lists both bets when the same request is attacked again later', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1', appetite: '6 weeks' })],
      shapes: [
        makeShape({ requestId: 'f1', shapeId: 's1', stage: 'done', cycleSlug: '2024-q1', currentCycle: false }),
        makeShape({ requestId: 'f1', shapeId: 's2', stage: 'shaping', currentCycle: true }),
      ],
      today: '2026-09-02',
    })
    expect(model.pins[0].shapes.map((s) => s.cycleSlug)).toEqual(['2024-q1', '2026-q3'])
  })
})

describe('monitoring', () => {
  const released = makeShape({ stage: 'done', currentCycle: false })

  it('has no end condition: a released request stays there until a person acts', () => {
    const request = makeRequest({ appetite: '6 weeks' })
    expect(requestState(request, [released])).toBe('monitoring')
    // Years later, nothing has moved it on by itself.
    expect(requestState(request, [released])).toBe('monitoring')
  })

  it('ends only when a person resolves the request', () => {
    const request = makeRequest({ appetite: '6 weeks', resolved: true })
    expect(requestState(request, [released])).toBe('resolved')
  })

  // A quiet release leaves the Product Map quietly (ADR 0024).
  it('keeps the dormancy clock running, so a quiet release goes to sleep', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1', appetite: '6 weeks', last_woken: '2026-01-20' })],
      shapes: [makeShape({ requestId: 'f1', stage: 'done', currentCycle: false })],
      cycles: CYCLES,
      today: '2026-03-31',
    })
    expect(model.pins).toHaveLength(0)
    expect(model.dormantReview).toHaveLength(1)
  })
})

describe('the origin chain', () => {
  const origin = makeRequest({ id: 'f1', problem: 'Imports fail silently' })
  const followOn = makeRequest({
    id: 'f2',
    problem: 'The new importer is too slow',
    originRequestId: 'f1',
  })

  it('names the request whose monitoring surfaced this one', () => {
    expect(originChain(followOn, [origin, followOn])).toEqual([
      { requestId: 'f1', problem: 'Imports fail silently' },
    ])
  })

  it('is empty for a request nothing surfaced', () => {
    expect(originChain(origin, [origin, followOn])).toEqual([])
  })

  it('walks two links back, nearest first', () => {
    const third = makeRequest({ id: 'f3', problem: 'Nobody uses the new importer', originRequestId: 'f2' })
    expect(originChain(third, [origin, followOn, third]).map((l) => l.requestId)).toEqual([
      'f2',
      'f1',
    ])
  })

  it('stops at a missing origin rather than throwing', () => {
    const orphan = makeRequest({ id: 'f9', originRequestId: 'gone' })
    expect(originChain(orphan, [orphan])).toEqual([])
  })

  it('stops on a chain that loops, so bad data cannot hang the Product Map', () => {
    const a = makeRequest({ id: 'a', originRequestId: 'b' })
    const b = makeRequest({ id: 'b', originRequestId: 'a' })
    expect(originChain(a, [a, b]).map((l) => l.requestId)).toEqual(['b'])
  })

  // Creating the follow-on request never reopens the origin (ADR 0025).
  it('leaves the origin request in monitoring', () => {
    const model = renderProductMap({
      requests: [{ ...origin, appetite: '6 weeks' }, followOn],
      shapes: [makeShape({ requestId: 'f1', stage: 'done', currentCycle: false })],
      today: '2026-09-02',
    })
    const [first, second] = model.pins
    expect(first.state).toBe('monitoring')
    expect(second.originChain[0].requestId).toBe('f1')
  })
})

describe('a resolved request', () => {
  const area = makeArea({ id: 'a1' })

  it('leaves the Product Map view', () => {
    const model = renderProductMap({
      areas: [area],
      requests: [makeRequest({ id: 'f1', areaId: 'a1', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.pins).toEqual([])
    expect(model.areas[0].pins).toEqual([])
    expect(model.unmapped).toEqual([])
  })

  it('stays on its area, with the shapes that resolved it', () => {
    const model = renderProductMap({
      areas: [area],
      requests: [makeRequest({ id: 'f1', areaId: 'a1', appetite: '6 weeks', resolved: true })],
      shapes: [makeShape({ requestId: 'f1', stage: 'done', currentCycle: false })],
      today: '2026-09-02',
    })
    expect(model.areas[0].resolved).toHaveLength(1)
    expect(model.areas[0].resolved[0].shapes[0].title).toBe('Silent import failures')
    expect(model.resolved).toHaveLength(1)
  })

  it('is never deleted, so it stays readable even with no area', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1', resolved: true })],
      today: '2026-09-02',
    })
    expect(model.resolved).toHaveLength(1)
    expect(model.unmapped).toEqual([])
    // Unmapped is a home like any other, so the record stays reachable there.
    expect(model.unmappedResolved).toHaveLength(1)
  })

  it('never lands in the dormant review, because it is not asleep', () => {
    const model = renderProductMap({
      requests: [makeRequest({ id: 'f1', resolved: true, last_woken: '2026-01-20' })],
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
      requests: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring).toEqual(ISLAND)
    expect(model.areas[0].path).toContain('C')
    expect(model.areas[0].path.endsWith(' Z')).toBe(true)
  })

  it('generates one for an area nobody has drawn, so old land still renders', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: undefined })],
      requests: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring.length).toBeGreaterThanOrEqual(3)
    expect(model.areas[0].path).not.toBe('')
  })

  it('falls back rather than drawing a sliver from a truncated outline', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: [[0, 0], [10, 10]] })],
      requests: [],
      today: '2026-09-03',
    })
    expect(model.areas[0].ring.length).toBeGreaterThanOrEqual(3)
  })

  it('puts the label inside the coastline', () => {
    const model = renderProductMap({
      areas: [makeArea({ outline: ISLAND })],
      requests: [],
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
      requests: [],
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
      requests: [],
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
      requests: [],
      today: '2026-09-03',
    })
    const arch = model.areas[0]
    expect(arch.level).toBe('archipelago')
    expect(arch.children[0].level).toBe('island')
    expect(arch.children[0].children[0].level).toBe('area')
  })

  it('reads a lone area with no children as an area', () => {
    const model = renderProductMap({ areas: [makeArea()], requests: [], today: '2026-09-03' })
    expect(model.areas[0].level).toBe('area')
  })
})

describe('pin placement', () => {
  it('puts every pin inside the area it is filed in', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [
        makeRequest({ id: 'f1', areaId: 'a1' }),
        makeRequest({ id: 'f2', areaId: 'a1' }),
        makeRequest({ id: 'f3', areaId: 'a1' }),
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

  it('leaves an Unmapped request with no position, because it lives in the tray', () => {
    const model = renderProductMap({
      areas: [],
      requests: [makeRequest({ id: 'f1' })],
      today: '2026-09-03',
    })
    expect(model.unmapped[0].at).toBeNull()
  })

  it('never moves a pin when another request is captured', () => {
    const args = { areas: [makeArea({ id: 'a1', outline: ISLAND })], today: '2026-09-03' }
    const before = renderProductMap({ ...args, requests: [makeRequest({ id: 'f1', areaId: 'a1' })] })
    const after = renderProductMap({
      ...args,
      requests: [
        makeRequest({ id: 'f0', areaId: 'a1' }),
        makeRequest({ id: 'f1', areaId: 'a1' }),
        makeRequest({ id: 'f2', areaId: 'a1' }),
      ],
    })
    const moved = after.pins.find((p) => p.requestId === 'f1')!
    expect(moved.at).toEqual(before.pins[0].at)
  })

  it('agrees between the flat pin list and the area tree', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [makeRequest({ id: 'f1', areaId: 'a1' })],
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
      requests: [
        makeRequest({ id: 'f1', areaId: 'leaf', kind: 'pain_point' }),
        makeRequest({ id: 'f2', areaId: 'isle', kind: 'brand_burn' }),
      ],
      today: '2026-09-03',
    })

  it('collapses a small archipelago into one bubble', () => {
    const nodes = clusterForViewport(archipelago().areas, 0.1)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].kind).toBe('bubble')
  })

  it('counts every request underneath the bubble, however deep', () => {
    const [node] = clusterForViewport(archipelago().areas, 0.1)
    expect(node.kind === 'bubble' && node.count).toBe(2)
  })

  it('numbers requests, never reports', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [
        makeRequest({
          id: 'f1',
          areaId: 'a1',
          reports: [makeReport(), makeReport(), makeReport()],
        }),
        makeRequest({ id: 'f2', areaId: 'a1', reports: [makeReport(), makeReport()] }),
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
      requests: [
        makeRequest({ id: 'f1', areaId: 'small' }),
        makeRequest({ id: 'f2', areaId: 'small' }),
        makeRequest({ id: 'f3', areaId: 'big' }),
        makeRequest({ id: 'f4', areaId: 'big' }),
      ],
      today: '2026-09-03',
    })
    // The parent spans 215 units and opens; inside it the 200-unit child opens
    // and the 10-unit child does not.
    const nodes = clusterForViewport(model.areas, 1.5)
    expect(nodes.map((n) => n.kind)).toEqual(['area', 'area', 'bubble'])
  })

  it('takes an outline when ANY request inside has work on it', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [makeRequest({ id: 'f1', areaId: 'a1' }), makeRequest({ id: 'f2', areaId: 'a1' })],
      shapes: [
        {
          requestId: 'f2',
          shapeId: 's1',
          title: 'Fix imports',
          stage: 'building',
          cycleSlug: 'c1',
          cycleTitle: 'Cycle 1',
          currentCycle: true,
          upcomingCycle: false,
        },
      ],
      today: '2026-09-03',
    })
    const [node] = clusterForViewport(model.areas, 0.1)
    expect(node.kind === 'bubble' && node.outline).toBe('solid')
  })

  it('takes its opacity from the freshest request inside, never the mean', () => {
    const cycles: CycleWindow[] = [
      { slug: 'c1', title: 'Cycle 1', type: 'build', start_date: '2026-01-01', end_date: '2026-02-11' },
      { slug: 'c2', title: 'Cycle 2', type: 'build', start_date: '2026-02-12', end_date: '2026-03-25' },
      { slug: 'c3', title: 'Cycle 3', type: 'build', start_date: '2026-03-26', end_date: '2026-05-06' },
    ]
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [
        // Dim, not dormant: a dormant request leaves the map and would not count.
        makeRequest({ id: 'stale', areaId: 'a1', last_woken: '2026-02-20' }),
        makeRequest({ id: 'fresh', areaId: 'a1', last_woken: '2026-05-01' }),
        makeRequest({ id: 'fresh2', areaId: 'a1', last_woken: '2026-05-02' }),
      ],
      cycles,
      today: '2026-05-06',
    })
    const stale = model.pins.find((p) => p.requestId === 'stale')!
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
      requests: [makeRequest({ id: 'f1', areaId: 'a1' })],
      today: '2026-09-03',
    })
    const nodes = clusterForViewport(model.areas, 0.1)
    expect(nodes.map((n) => n.kind)).toEqual(['area'])
  })

  it('never bubbles an empty area', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: ISLAND })],
      requests: [],
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
      requests: [
        makeRequest({
          id: 'internal-only',
          areaId: 'a1',
          reports: [makeReport({ source: 'internal' })],
        }),
        makeRequest({
          id: 'customer-1',
          areaId: 'a1',
          reports: [makeReport({ source: 'customer', customer: 'Northwind' })],
        }),
        makeRequest({
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

  it('keeps a request nobody has reported yet, so a fresh capture never vanishes', () => {
    const model = renderProductMap({
      areas: [makeArea({ id: 'a1', outline: AREA_RING })],
      requests: [makeRequest({ id: 'f1', areaId: 'a1', reports: [] })],
      lens: 'all',
      today: '2026-09-03',
    })
    expect(model.pins[0].passesLens).toBe(true)
  })

  it('drops a request only the team raised, under the customer lens', () => {
    const passing = mapWith('customer').pins.filter((p) => p.passesLens).map((p) => p.requestId)
    expect(passing).toEqual(['customer-1', 'customer-2'])
  })

  it('shrinks the bubble to what customers actually raised', () => {
    const everyone = clusterForViewport(mapWith('all').areas, 0.1)
    const customers = clusterForViewport(mapWith('customer').areas, 0.1)
    expect(everyone[0].kind === 'bubble' && everyone[0].count).toBe(3)
    expect(customers[0].kind === 'bubble' && customers[0].count).toBe(2)
  })

  it('drops the customer requests under the internal lens', () => {
    const internal = clusterForViewport(mapWith('internal').areas, 0.1)
    // One request left, so it draws as a pin rather than a bubble reading "1".
    expect(internal.map((n) => n.kind)).toEqual(['area'])
  })
})

describe('renderRequest', () => {
  const cycles: CycleWindow[] = [
    { slug: 'c1', title: 'One', type: 'build', start_date: '2026-01-05', end_date: '2026-02-13' },
    { slug: 'c2', title: 'Two', type: 'build', start_date: '2026-02-23', end_date: '2026-04-03' },
    { slug: 'c3', title: 'Three', type: 'build', start_date: '2026-04-13', end_date: '2026-05-22' },
  ]

  // A request page has a URL, so it must open a request the map no longer shows.
  it('renders a dormant request that the map leaves out', () => {
    const requests = [makeRequest({ last_woken: '2025-12-01' })]
    const input = { requests, cycles, today: '2026-05-01' }

    expect(renderProductMap(input).pins).toHaveLength(0)
    const pin = renderRequest(input, 'f1')
    expect(pin?.dormant).toBe(true)
    expect(pin?.problem).toBe('Imports fail silently')
  })

  it('carries the brief, and null before anybody wrote one', () => {
    const brief = {
      headline: 'h',
      where_we_are: 'w',
      next_step: 'n',
      written_by: 'paulo',
      written_on: '2026-04-01',
    }
    const requests = [makeRequest(), makeRequest({ id: 'f2', brief })]

    expect(renderRequest({ requests, today: '2026-05-01' }, 'f1')?.brief).toBeNull()
    expect(renderRequest({ requests, today: '2026-05-01' }, 'f2')?.brief).toEqual(brief)
  })

  it('returns null for an unknown request', () => {
    expect(renderRequest({ requests: [makeRequest()], today: '2026-05-01' }, 'nope')).toBeNull()
  })
})

describe('withReportIds', () => {
  const old = { capturer: 'u', source: 'internal' as const, text: 'again', date: '2026-08-01' }

  it('keeps a stored id and derives a stable one for an old report', () => {
    const [stored, derived] = withReportIds([{ ...old, id: 'r1' }, old])
    expect(stored.id).toBe('r1')
    expect(derived.id).toMatch(/^r_/)
    expect(withReportIds([old])[0].id).toBe(derived.id)
  })

  it('gives identical old reports different ids', () => {
    const ids = withReportIds([old, old, old]).map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
  })

  // The first edit stores the derived id; the identical twin must not take it.
  it('never derives an id that a stored report already holds', () => {
    const first = withReportIds([old])[0].id
    const [, twin] = withReportIds([{ ...old, id: first, text: 'edited' }, old])
    expect(twin.id).not.toBe(first)
  })
})

describe('related requests', () => {
  const request = (id: string, related?: string[]) =>
    ({ id, problem: `p-${id}`, related_request_ids: related }) as ProductRequest

  it('reads the relation from either side and drops a request that is gone', () => {
    const requests = [request('a', ['b', 'gone']), request('b'), request('c', ['a'])]
    expect(relatedRequests(requests[0], requests).map((r) => r.requestId)).toEqual(['b', 'c'])
    expect(relatedRequests(requests[1], requests)).toEqual([{ requestId: 'a', problem: 'p-a' }])
  })

  it('returns only the lists that change, on both sides', () => {
    const changes = relateRequests([request('a', ['b']), request('b', ['a']), request('c')], 'a', ['c'])
    expect(Object.fromEntries(changes)).toEqual({ a: ['c'], b: [], c: ['a'] })
  })
})

describe('seeding a pitch from its requests', () => {
  it('copies the outcomes of every request and takes the largest appetite', () => {
    const seed = seedPitchFrame([
      makeRequest({
        problem: 'Exports time out',
        appetite: '2 weeks',
        outcomes: [{ id: 'o1', text: 'A year of data exports' }],
      }),
      makeRequest({
        problem: 'Exports miss custom fields',
        appetite: '6 weeks',
        outcomes: [{ id: 'o2', text: 'Custom fields appear in the export' }],
      }),
      makeRequest({ problem: 'Export is slow', appetite: '3 days', outcomes: [] }),
    ])
    expect(seed.frame_outcomes).toEqual([
      { id: 'o1', text: 'A year of data exports' },
      { id: 'o2', text: 'Custom fields appear in the export' },
    ])
    expect(seed.frame_appetite).toBe('6 weeks')
    expect(seed.frame_problem).toBe(
      'Exports time out\nExports miss custom fields\nExport is slow'
    )
  })

  it('carries the release draft of a request into the release summary', () => {
    const seed = seedPitchFrame([
      makeRequest({ announcement: '' }),
      makeRequest({ announcement: 'Exports now finish, whatever their size.' }),
    ])
    expect(seed.release_summary).toBe('Exports now finish, whatever their size.')
  })

  it('keeps the first appetite when none can be compared', () => {
    const seed = seedPitchFrame([
      makeRequest({ appetite: 'a small batch' }),
      makeRequest({ appetite: 'a big batch' }),
    ])
    expect(seed.frame_appetite).toBe('a small batch')
  })
})
