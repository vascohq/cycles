import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePitchDocumentTitle } from './use-pitch-document-title'

afterEach(() => {
  document.title = ''
})

describe('usePitchDocumentTitle', () => {
  it('sets document title with emoji and pitch title', () => {
    renderHook(() =>
      usePitchDocumentTitle({ emoji: '🎯', title: 'My Pitch' }, 'Cycle 12')
    )
    expect(document.title).toBe('🎯 My Pitch | Cycle 12 | Cycles')
  })

  it('omits emoji when empty', () => {
    renderHook(() =>
      usePitchDocumentTitle({ emoji: '', title: 'My Pitch' }, 'Cycle 12')
    )
    expect(document.title).toBe('My Pitch | Cycle 12 | Cycles')
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
