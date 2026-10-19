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
    render(<DraftMarkdown value="old" rows={3} label="Why" onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Why' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '`new`' } })
    fireEvent.blur(screen.getByRole('textbox'))

    expect(onCommit).toHaveBeenCalledWith('`new`')
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
})
