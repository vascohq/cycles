import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { formatPitchTitle, usePitchDocumentTitle } from './use-pitch-document-title'

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
})

describe('usePitchDocumentTitle', () => {
  afterEach(() => {
    document.title = ''
  })

  it('sets document title on mount', () => {
    renderHook(() =>
      usePitchDocumentTitle({ emoji: '🎯', title: 'My Pitch' }, 'Cycle 12')
    )
    expect(document.title).toBe('🎯 My Pitch | Cycle 12 | Cycles')
  })

  it('updates when emoji changes', () => {
    let emoji = ''
    const { rerender } = renderHook(() =>
      usePitchDocumentTitle({ emoji, title: 'My Pitch' }, 'Cycle 12')
    )
    expect(document.title).toBe('My Pitch | Cycle 12 | Cycles')

    act(() => { emoji = '🎯' })
    rerender()
    expect(document.title).toBe('🎯 My Pitch | Cycle 12 | Cycles')
  })
})
