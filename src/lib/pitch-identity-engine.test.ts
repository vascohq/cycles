import { describe, it, expect } from 'vitest'
import { normalizeEmoji, validateNotionUrl } from './pitch-identity-engine'

describe('normalizeEmoji', () => {
  it('returns a single emoji unchanged', () => {
    expect(normalizeEmoji('🚀')).toBe('🚀')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeEmoji('  🎯  ')).toBe('🎯')
  })

  it('rejects plain text to empty string', () => {
    expect(normalizeEmoji('hello')).toBe('')
  })

  it('rejects multiple emoji to empty string', () => {
    expect(normalizeEmoji('🚀🎯')).toBe('')
  })

  it('rejects an emoji with trailing text to empty string', () => {
    expect(normalizeEmoji('🚀 go')).toBe('')
  })

  it('keeps a skin-tone modified emoji as a single grapheme', () => {
    expect(normalizeEmoji('👍🏽')).toBe('👍🏽')
  })

  it('keeps a ZWJ family sequence as a single grapheme', () => {
    expect(normalizeEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeEmoji('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeEmoji('   ')).toBe('')
  })
})

describe('validateNotionUrl', () => {
  it('accepts a notion.so URL as a valid Notion host', () => {
    expect(validateNotionUrl('https://www.notion.so/My-Pitch-abc123')).toEqual({
      value: 'https://www.notion.so/My-Pitch-abc123',
      isValidUrl: true,
      isNotionHost: true,
    })
  })

  it('accepts a notion.site published page as a Notion host', () => {
    const result = validateNotionUrl('https://my-team.notion.site/Pitch-xyz')
    expect(result.isValidUrl).toBe(true)
    expect(result.isNotionHost).toBe(true)
  })

  it('treats a valid https non-Notion URL as valid but not a Notion host', () => {
    const result = validateNotionUrl('https://example.com/doc')
    expect(result.isValidUrl).toBe(true)
    expect(result.isNotionHost).toBe(false)
  })

  it('rejects an http URL as invalid', () => {
    expect(validateNotionUrl('http://www.notion.so/x').isValidUrl).toBe(false)
  })

  it('treats a malformed string as invalid without throwing', () => {
    expect(validateNotionUrl('not a url')).toEqual({
      value: 'not a url',
      isValidUrl: false,
      isNotionHost: false,
    })
  })

  it('treats empty input as invalid without throwing', () => {
    expect(validateNotionUrl('')).toEqual({
      value: '',
      isValidUrl: false,
      isNotionHost: false,
    })
  })
})
