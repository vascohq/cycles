import { describe, it, expect } from 'vitest'
import { parseIntegrationConfig } from './integration-config'

describe('parseIntegrationConfig', () => {
  it('accepts a valid feed list', () => {
    const raw = {
      feeds: [
        { kind: 'holiday', label: 'Canada', url: 'https://example.com/ca.ics' },
        { kind: 'timeoff', label: 'Humi', url: 'webcal://api.humi.ca/feed.ics' },
      ],
    }

    const config = parseIntegrationConfig(raw)

    expect(config.feeds).toEqual([
      { kind: 'holiday', label: 'Canada', url: 'https://example.com/ca.ics' },
      { kind: 'timeoff', label: 'Humi', url: 'webcal://api.humi.ca/feed.ics' },
    ])
  })

  it('rejects a feed with an unknown kind', () => {
    const raw = { feeds: [{ kind: 'birthday', label: 'X', url: 'https://x.ics' }] }

    expect(() => parseIntegrationConfig(raw)).toThrow()
  })

  it('rejects a feed missing its url', () => {
    const raw = { feeds: [{ kind: 'holiday', label: 'Canada' }] }

    expect(() => parseIntegrationConfig(raw)).toThrow()
  })

  it('treats an empty object as a valid config with no feeds', () => {
    expect(parseIntegrationConfig({}).feeds).toEqual([])
  })
})
