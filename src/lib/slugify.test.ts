import { describe, it, expect } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Mission Control')).toBe('mission-control')
  })

  it('collapses multiple spaces', () => {
    expect(slugify('A  B   C')).toBe('a-b-c')
  })

  it('strips parentheses, ampersands, and special characters', () => {
    expect(slugify('Agentic Capabilities (Skills & Tools)')).toBe(
      'agentic-capabilities-skills-tools'
    )
  })

  it('collapses consecutive hyphens left by stripped characters', () => {
    expect(slugify('A -- B')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('(Hello World)')).toBe('hello-world')
  })
})
