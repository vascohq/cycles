import { describe, expect, it } from 'vitest'
import { formatPitchTitle } from './pitch-title'

describe('formatPitchTitle', () => {
  it('includes emoji when set', () => {
    expect(formatPitchTitle({ emoji: '🎯', title: 'My Pitch' }, 'Cycle 12')).toBe(
      '🎯 My Pitch | Cycle 12 | Cycles'
    )
  })

  it('omits emoji when empty', () => {
    expect(formatPitchTitle({ emoji: '', title: 'My Pitch' }, 'Cycle 12')).toBe(
      'My Pitch | Cycle 12 | Cycles'
    )
  })

  it('uses fallback label when pitch is null', () => {
    expect(formatPitchTitle(null, 'Cycle 12', 'my-pitch')).toBe(
      'my-pitch | Cycle 12 | Cycles'
    )
  })
})
