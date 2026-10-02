import { describe, it, expect } from 'vitest'
import { freshnessOf, keepFrames, listFrames } from './frame-list'
import type { RenderedArea, RenderedPin } from './product-map-engine'

function pin(overrides: Partial<RenderedPin>): RenderedPin {
  return {
    frameId: 'f',
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

describe('listFrames', () => {
  // A resolved frame is off the map, so the list hides it unless asked.
  it('leaves resolved frames out unless the state filter asks for them', () => {
    const pins = [pin({ frameId: 'open' }), pin({ frameId: 'done', state: 'resolved' })]

    expect(listFrames(pins, {}).map((p) => p.frameId)).toEqual(['open'])
    expect(listFrames(pins, { state: 'resolved' }).map((p) => p.frameId)).toEqual(['done'])
  })

  it('puts the freshest first, and the most reported among equals', () => {
    const pins = [
      pin({ frameId: 'old', opacity: 0.4, reports: [report('customer'), report('customer')] }),
      pin({ frameId: 'fresh-quiet', opacity: 1 }),
      pin({ frameId: 'fresh-loud', opacity: 1, reports: [report('internal')] }),
    ]

    expect(listFrames(pins, {}).map((p) => p.frameId)).toEqual(['fresh-loud', 'fresh-quiet', 'old'])
    expect(listFrames(pins, { sort: 'reports' })[0].frameId).toBe('old')
  })

  it('matches an area and everything under it, and "unmapped" for no area', () => {
    const pins = [pin({ frameId: 'in', areaId: 'child' }), pin({ frameId: 'out', areaId: 'other' }), pin({ frameId: 'loose', areaId: '' })]

    expect(listFrames(pins, {}, new Set(['parent', 'child'])).map((p) => p.frameId)).toEqual(['in'])
    expect(listFrames(pins, {}, new Set(['unmapped'])).map((p) => p.frameId)).toEqual(['loose'])
  })

  it('filters by owner, including frames nobody owns', () => {
    const pins = [pin({ frameId: 'mine', owner: 'u1' }), pin({ frameId: 'orphan' })]

    expect(listFrames(pins, { owner: 'u1' }).map((p) => p.frameId)).toEqual(['mine'])
    expect(listFrames(pins, { owner: 'nobody' }).map((p) => p.frameId)).toEqual(['orphan'])
  })

  it('keeps frames with a report from the chosen side, like the heat lens', () => {
    const pins = [pin({ frameId: 'heard', reports: [report('customer')] }), pin({ frameId: 'internal', reports: [report('internal')] })]

    expect(listFrames(pins, { source: 'customer' }).map((p) => p.frameId)).toEqual(['heard'])
  })

  it('filters by freshness, kind and type together', () => {
    const pins = [
      pin({ frameId: 'hit', kind: 'brand_burn', type: 'bug', opacity: 0.9 }),
      pin({ frameId: 'stale', kind: 'brand_burn', type: 'bug', opacity: 0.4 }),
      pin({ frameId: 'idea', kind: 'brand_burn', type: 'idea', opacity: 0.9 }),
    ]

    const result = listFrames(pins, { kind: 'brand_burn', type: 'bug', freshness: 'top_of_mind' })
    expect(result.map((p) => p.frameId)).toEqual(['hit'])
  })
})

describe('keepFrames', () => {
  // The filters shape the map too, but the land never changes, so it never jumps.
  it('drops the frames not kept, at every level, and keeps every area', () => {
    const area = (id: string, pins: string[], children: RenderedArea[] = []) =>
      ({ areaId: id, pins: pins.map((frameId) => pin({ frameId })), resolved: [], children }) as unknown as RenderedArea
    const tree = [area('root', ['a', 'b'], [area('leaf', ['c', 'd'])])]

    const kept = keepFrames(tree, new Set(['a', 'd']))

    expect(kept[0].pins.map((p) => p.frameId)).toEqual(['a'])
    expect(kept[0].children[0].pins.map((p) => p.frameId)).toEqual(['d'])
    expect(kept[0].children[0].areaId).toBe('leaf')
  })
})
