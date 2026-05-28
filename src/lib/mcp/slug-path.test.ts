import { describe, it, expect } from 'vitest'
import { parseSlugPath, isValidSlugSegment } from './slug-path'

describe('isValidSlugSegment', () => {
  it('accepts lowercase alphanumeric slugs with hyphens and underscores', () => {
    expect(isValidSlugSegment('2026-q3-build')).toBe(true)
    expect(isValidSlugSegment('my_cycle-1')).toBe(true)
    expect(isValidSlugSegment('34')).toBe(true)
  })

  it('rejects uppercase, spaces, slashes, and empty strings', () => {
    expect(isValidSlugSegment('UPPER')).toBe(false)
    expect(isValidSlugSegment('hello world')).toBe(false)
    expect(isValidSlugSegment('a/b')).toBe(false)
    expect(isValidSlugSegment('')).toBe(false)
    expect(isValidSlugSegment('-leading')).toBe(false)
  })
})

describe('parseSlugPath', () => {
  it('parses a single segment as a cycle slug', () => {
    expect(parseSlugPath('2026-q2-build')).toEqual({
      kind: 'cycle',
      cycleSlug: '2026-q2-build',
    })
  })

  it('parses two segments as cycle + pitch slug', () => {
    expect(parseSlugPath('2026-q2-build/mission-control')).toEqual({
      kind: 'pitch',
      cycleSlug: '2026-q2-build',
      pitchSlug: 'mission-control',
    })
  })

  it('trims leading and trailing slashes', () => {
    expect(parseSlugPath('/2026-q2-build/')).toEqual({
      kind: 'cycle',
      cycleSlug: '2026-q2-build',
    })
  })

  it('throws on empty path', () => {
    expect(() => parseSlugPath('')).toThrow()
    expect(() => parseSlugPath('/')).toThrow()
  })

  it('throws on three or more segments', () => {
    expect(() => parseSlugPath('a/b/c')).toThrow()
  })

  it('throws on segments with invalid characters', () => {
    expect(() => parseSlugPath('hello world')).toThrow()
    expect(() => parseSlugPath('../../etc')).toThrow()
    expect(() => parseSlugPath('UPPER')).toThrow()
  })

  it('allows underscores and hyphens', () => {
    expect(parseSlugPath('my_cycle-1')).toEqual({
      kind: 'cycle',
      cycleSlug: 'my_cycle-1',
    })
  })
})
