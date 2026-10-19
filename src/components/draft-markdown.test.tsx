import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DraftMarkdown } from './draft-markdown'

afterEach(cleanup)

describe('DraftMarkdown', () => {
  it('reads as rendered Markdown, and a click opens the textarea', () => {
    render(<DraftMarkdown value={'**Context:** a\nb'} rows={3} label="Why" onCommit={() => {}} />)
    expect(screen.getByText('Context:').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Why' }))
    expect(screen.getByRole('textbox')).toHaveValue('**Context:** a\nb')
  })

  it('commits on blur and shows the rendered text again', () => {
    const onCommit = vi.fn()
    const { rerender } = render(
      <DraftMarkdown value="old" rows={3} label="Why" onCommit={onCommit} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit Why' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '`new`' } })
    fireEvent.blur(screen.getByRole('textbox'))

    expect(onCommit).toHaveBeenCalledWith('`new`')
    // The room hands the committed text back as the new value.
    rerender(<DraftMarkdown value="`new`" rows={3} label="Why" onCommit={onCommit} />)
    expect(screen.getByText('new').tagName).toBe('CODE')
  })

  it('stays a textarea while the first characters are typed into an empty field', () => {
    render(<DraftMarkdown value="" rows={3} label="Why" onCommit={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } })
    expect(screen.getByRole('textbox')).toHaveValue('a')
  })

  it('opens a link inside the text instead of the editor', () => {
    render(<DraftMarkdown value="[docs](https://x.test)" rows={3} label="Why" onCommit={() => {}} />)
    fireEvent.click(screen.getByRole('link', { name: 'docs' }))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  // Somebody else edited the text while the dialog was open. A click and a
  // blur with no typing must not write the old copy back over theirs.
  it('shows text changed elsewhere, and never commits a stale copy over it', () => {
    const onCommit = vi.fn()
    const { rerender } = render(
      <DraftMarkdown value="old" rows={3} label="Why" onCommit={onCommit} />
    )
    rerender(<DraftMarkdown value="**new**" rows={3} label="Why" onCommit={onCommit} />)
    expect(screen.getByText('new').tagName).toBe('STRONG')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Why' }))
    expect(screen.getByRole('textbox')).toHaveValue('**new**')
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows raw HTML as text and never renders it', () => {
    const html = '<b>bold</b> <img src=x onerror=alert(1)>'
    render(<DraftMarkdown value={html} rows={3} label="Why" onCommit={() => {}} />)
    const field = screen.getByRole('button', { name: 'Edit Why' })
    expect(field.querySelector('b, img')).toBeNull()
    expect(field).toHaveTextContent('<b>bold</b> <img src=x onerror=alert(1)>')
  })
})
