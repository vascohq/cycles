import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toSlug, CreateBoardForm } from './create-board-form'

vi.mock('@/app/boards/actions', () => ({
  createRoom: vi.fn(),
}))

vi.mock('@/components/ui/dialog', () => ({
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

describe('toSlug', () => {
  it('converts a simple title to a slug', () => {
    expect(toSlug('My Awesome Board')).toBe('my-awesome-board')
  })

  it('strips special characters', () => {
    expect(toSlug('Hello, World! #1')).toBe('hello-world-1')
  })

  it('collapses multiple spaces and dashes', () => {
    expect(toSlug('too   many   spaces')).toBe('too-many-spaces')
    expect(toSlug('too---many---dashes')).toBe('too-many-dashes')
  })

  it('trims leading and trailing whitespace and dashes', () => {
    expect(toSlug('  hello  ')).toBe('hello')
    expect(toSlug('--hello--')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(toSlug('')).toBe('')
  })

  it('handles accented and non-ascii characters by stripping them', () => {
    expect(toSlug('café résumé')).toBe('caf-rsum')
  })
})

describe('CreateBoardForm', () => {
  afterEach(cleanup)

  it('auto-fills slug from title', async () => {
    const user = userEvent.setup()
    render(<CreateBoardForm />)

    const titleInput = screen.getByLabelText('Board title')
    await user.type(titleInput, 'My New Board')

    const slugInput = screen.getByLabelText('Slug')
    expect(slugInput).toHaveValue('my-new-board')
  })

  it('stops auto-filling slug once user edits it', async () => {
    const user = userEvent.setup()
    render(<CreateBoardForm />)

    const titleInput = screen.getByLabelText('Board title')
    const slugInput = screen.getByLabelText('Slug')

    await user.type(titleInput, 'First')
    expect(slugInput).toHaveValue('first')

    await user.click(slugInput)
    await user.clear(slugInput)
    await user.type(slugInput, 'custom-slug')

    await user.click(titleInput)
    await user.type(titleInput, ' Title')

    expect(slugInput).toHaveValue('custom-slug')
  })
})
