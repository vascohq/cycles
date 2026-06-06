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
        { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://example.com/ca.ics' },
        { id: 'b', kind: 'timeoff', label: 'Humi', url: 'webcal://api.humi.ca/feed.ics' },
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
  { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://ca.ics' },
  { id: 'b', kind: 'timeoff', label: 'Humi', url: 'webcal://humi.ics?token=secret' },
]

describe('redactFeeds', () => {
  it('exposes id/kind/label and whether a url is set, never the url', () => {
    expect(redactFeeds(stored)).toEqual([
      { id: 'a', kind: 'holiday', label: 'Canada', hasUrl: true },
      { id: 'b', kind: 'timeoff', label: 'Humi', hasUrl: true },
    ])
  })
})

describe('mergeFeedInputs', () => {
  it('keeps the stored url when an input leaves it blank (label-only edit)', () => {
    const merged = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada 🇨🇦', url: '' },
      { id: 'b', kind: 'timeoff', label: 'Humi' },
    ])

    expect(merged).toEqual([
      { id: 'a', kind: 'holiday', label: 'Canada 🇨🇦', url: 'https://ca.ics' },
      { id: 'b', kind: 'timeoff', label: 'Humi', url: 'webcal://humi.ics?token=secret' },
    ])
  })

  it('replaces the url when an input provides a new one', () => {
    const [merged] = mergeFeedInputs(stored, [
      { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://new.ics' },
    ])

    expect(merged.url).toBe('https://new.ics')
  })

  it('drops a stored feed that is absent from the inputs', () => {
    const merged = mergeFeedInputs(stored, [{ id: 'a', kind: 'holiday', label: 'Canada' }])

    expect(merged.map((f) => f.id)).toEqual(['a'])
  })

  it('throws when a brand-new feed has no url to store', () => {
    expect(() =>
      mergeFeedInputs(stored, [{ id: 'new', kind: 'holiday', label: 'France', url: '' }])
    ).toThrow()
  })
})
