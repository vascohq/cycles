import { describe, it, expect } from 'vitest'
import {
  parseIntegrationConfig,
  mergeFeedInputs,
  redactFeeds,
  type Feed,
} from './integration-config'

describe('parseIntegrationConfig', () => {
  it('accepts a valid feed list', () => {
    const raw = {
      feeds: [
        { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://example.com/ca.ics', color: '#3e63dd' },
        { id: 'b', kind: 'timeoff', label: 'Humi', url: 'webcal://api.humi.ca/feed.ics', color: '#30a46c' },
      ],
    }

    expect(parseIntegrationConfig(raw).feeds).toEqual(raw.feeds)
  })

  it('rejects a feed with an unknown kind', () => {
    const raw = { feeds: [{ id: 'a', kind: 'birthday', label: 'X', url: 'https://x.ics' }] }

    expect(() => parseIntegrationConfig(raw)).toThrow()
  })

  it('rejects a feed missing its url', () => {
    const raw = { feeds: [{ id: 'a', kind: 'holiday', label: 'Canada' }] }

    expect(() => parseIntegrationConfig(raw)).toThrow()
  })

  it('treats an empty object as a valid config with no feeds', () => {
    expect(parseIntegrationConfig({}).feeds).toEqual([])
  })
})

const stored: Feed[] = [
  { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://ca.ics', color: '#3e63dd' },
  { id: 'b', kind: 'timeoff', label: 'Humi', url: 'webcal://humi.ics?token=secret', color: '#30a46c' },
]

describe('redactFeeds', () => {
  it('exposes id/kind/label/color and whether a url is set, never the url', () => {
    expect(redactFeeds(stored)).toEqual([
      { id: 'a', kind: 'holiday', label: 'Canada', color: '#3e63dd', hasUrl: true },
      { id: 'b', kind: 'timeoff', label: 'Humi', color: '#30a46c', hasUrl: true },
    ])
  })
})

describe('mergeFeedInputs', () => {
  it('keeps the stored url when an input leaves it blank (label-only edit)', () => {
    const merged = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada 🇨🇦', color: '#3e63dd', url: '' },
      { id: 'b', kind: 'timeoff', label: 'Humi', color: '#30a46c' },
    ])

    expect(merged).toEqual([
      { id: 'a', kind: 'holiday', label: 'Canada 🇨🇦', color: '#3e63dd', url: 'https://ca.ics' },
      { id: 'b', kind: 'timeoff', label: 'Humi', color: '#30a46c', url: 'webcal://humi.ics?token=secret' },
    ])
  })

  it('replaces the url when an input provides a new one', () => {
    const [merged] = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada', color: '#3e63dd', url: 'https://new.ics' },
    ])

    expect(merged.url).toBe('https://new.ics')
  })

  it('keeps the new color on a label/colour edit', () => {
    const [merged] = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada', color: '#8e4ec6' },
    ])

    expect(merged.color).toBe('#8e4ec6')
    expect(merged.url).toBe('https://ca.ics')
  })

  it('drops a stored feed that is absent from the inputs', () => {
    const merged = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada', color: '#3e63dd' },
    ])

    expect(merged.map((f) => f.id)).toEqual(['a'])
  })

  it('throws when a brand-new feed has no url to store', () => {
    expect(() =>
      mergeFeedInputs(stored, [{ id: 'new', kind: 'holiday', label: 'France', color: '#e5484d', url: '' }])
    ).toThrow()
  })
})
