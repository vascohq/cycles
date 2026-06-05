import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CoreScopePrompt } from './core-scope-prompt'

afterEach(cleanup)

const SCOPES = [
  { id: 's1', title: 'Auth flow' },
  { id: 's2', title: 'Dashboard' },
]

describe('CoreScopePrompt', () => {
  it('explains what a core scope is and lists the scopes by name', () => {
    render(<CoreScopePrompt scopes={SCOPES} onChoose={vi.fn()} />)
    // Teaches a newcomer the concept in plain language.
    expect(screen.getByText(/heart of the pitch/i)).toBeTruthy()
    expect(screen.getByText(/build first/i)).toBeTruthy()
    // Picker lists each scope by name.
    expect(screen.getByRole('option', { name: 'Auth flow' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Dashboard' })).toBeTruthy()
  })

  it('sets the chosen scope as core when one is picked', () => {
    const onChoose = vi.fn()
    render(<CoreScopePrompt scopes={SCOPES} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's2' } })
    expect(onChoose).toHaveBeenCalledWith('s2')
  })
})
