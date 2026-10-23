import { describe, it, expect } from 'vitest'
import { freshnessOf, keepRequests, listRequests } from './request-list'
import type { RenderedArea, RenderedPin } from './product-map-engine'

function pin(overrides: Partial<RenderedPin>): RenderedPin {
  return {
    requestId: 'f',
    areaId: 'a1',
    kind: 'pain_point',
    type: 'bug',
    state: 'candidate',
    owner: null,
    opacity: 1,
    reports: [],
    ...overrides,
  } as RenderedPin
}

const report = (source: 'internal' | 'customer') => ({
  id: 'r',
  capturer: 'u',
  source,
  text: 't',
  date: '2026-09-01',
})

describe('freshnessOf', () => {
  it('reads top of mind, cooling and fading off the pin opacity', () => {
    expect(freshnessOf(1)).toBe('top_of_mind')
    expect(freshnessOf(0.8)).toBe('top_of_mind')
    expect(freshnessOf(0.6)).toBe('cooling')
    expect(freshnessOf(0.35)).toBe('fading')
  })
})

describe('listRequests', () => {
  // A resolved request is off the map, so the list hides it unless asked.
  it('leaves resolved requests out unless the state filter asks for them', () => {
    const pins = [pin({ requestId: 'open' }), pin({ requestId: 'done', state: 'resolved' })]

    expect(listRequests(pins, {}).map((p) => p.requestId)).toEqual(['open'])
    expect(listRequests(pins, { state: 'resolved' }).map((p) => p.requestId)).toEqual(['done'])
  })

  it('puts the freshest first, and the most reported among equals', () => {
    const pins = [
      pin({ requestId: 'old', opacity: 0.4, reports: [report('customer'), report('customer')] }),
      pin({ requestId: 'fresh-quiet', opacity: 1 }),
      pin({ requestId: 'fresh-loud', opacity: 1, reports: [report('internal')] }),
    ]

    expect(listRequests(pins, {}).map((p) => p.requestId)).toEqual(['fresh-loud', 'fresh-quiet', 'old'])
    expect(listRequests(pins, { sort: 'reports' })[0].requestId).toBe('old')
  })

  it('matches an area and everything under it, and "unmapped" for no area', () => {
    const pins = [pin({ requestId: 'in', areaId: 'child' }), pin({ requestId: 'out', areaId: 'other' }), pin({ requestId: 'loose', areaId: '' })]

    expect(listRequests(pins, {}, new Set(['parent', 'child'])).map((p) => p.requestId)).toEqual(['in'])
    expect(listRequests(pins, {}, new Set(['unmapped'])).map((p) => p.requestId)).toEqual(['loose'])
  })

  it('filters by who raised the request, a member or a free-text name', () => {
    const pins = [
      pin({ requestId: 'member', raisedBy: 'u1' }),
      pin({ requestId: 'outside', raisedBy: 'Jane at Acme' }),
      pin({ requestId: 'unknown' }),
    ]
    expect(listRequests(pins, { raised_by: 'u1' }).map((p) => p.requestId)).toEqual(['member'])
    expect(listRequests(pins, { raised_by: 'Jane at Acme' }).map((p) => p.requestId)).toEqual([
      'outside',
    ])
  })

  it('filters by owner, including requests nobody owns', () => {
    const pins = [pin({ requestId: 'mine', owner: 'u1' }), pin({ requestId: 'orphan' })]

    expect(listRequests(pins, { owner: 'u1' }).map((p) => p.requestId)).toEqual(['mine'])
    expect(listRequests(pins, { owner: 'nobody' }).map((p) => p.requestId)).toEqual(['orphan'])
  })

  it('keeps requests with a report from the chosen side, like the heat lens', () => {
    const pins = [pin({ requestId: 'heard', reports: [report('customer')] }), pin({ requestId: 'internal', reports: [report('internal')] })]

    expect(listRequests(pins, { source: 'customer' }).map((p) => p.requestId)).toEqual(['heard'])
  })

  it('filters by freshness, kind and type together', () => {
    const pins = [
      pin({ requestId: 'hit', kind: 'brand_burn', type: 'bug', opacity: 0.9 }),
      pin({ requestId: 'stale', kind: 'brand_burn', type: 'bug', opacity: 0.4 }),
      pin({ requestId: 'idea', kind: 'brand_burn', type: 'idea', opacity: 0.9 }),
    ]

    const result = listRequests(pins, { kind: 'brand_burn', type: 'bug', freshness: 'top_of_mind' })
    expect(result.map((p) => p.requestId)).toEqual(['hit'])
  })
})

describe('keepRequests', () => {
  // The filters shape the map too, but the land never changes, so it never jumps.
  it('drops the requests not kept, at every level, and keeps every area', () => {
    const area = (id: string, pins: string[], children: RenderedArea[] = []) =>
      ({ areaId: id, pins: pins.map((requestId) => pin({ requestId })), resolved: [], children }) as unknown as RenderedArea
    const tree = [area('root', ['a', 'b'], [area('leaf', ['c', 'd'])])]

    const kept = keepRequests(tree, new Set(['a', 'd']))

    expect(kept[0].pins.map((p) => p.requestId)).toEqual(['a'])
    expect(kept[0].children[0].pins.map((p) => p.requestId)).toEqual(['d'])
    expect(kept[0].children[0].areaId).toBe('leaf')
  })
})
