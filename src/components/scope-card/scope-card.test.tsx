import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ScopeCard } from './scope-card'

afterEach(cleanup)

const BASE_PROPS = {
  id: 's1',
  order: 1,
  title: 'Auth flow',
  tier: 'must' as const,
  litmus_text: '',
  tasks: [
    { id: 't1', title: 'Login page', done: true },
    { id: 't2', title: 'Token refresh', done: false },
  ],
}

describe('ScopeCard actions menu trigger', () => {
  it('renders the actions trigger when onEdit is provided', () => {
    const { container } = render(<ScopeCard {...BASE_PROPS} onEdit={vi.fn()} />)
    expect(container.querySelector('[aria-label="Scope actions"]')).toBeTruthy()
  })

  it('renders the actions trigger when onDelete is provided', () => {
    const { container } = render(<ScopeCard {...BASE_PROPS} onDelete={vi.fn()} />)
    expect(container.querySelector('[aria-label="Scope actions"]')).toBeTruthy()
  })

  it('does not render the actions trigger in readOnly mode', () => {
    const { container } = render(
      <ScopeCard {...BASE_PROPS} onEdit={vi.fn()} onDelete={vi.fn()} readOnly />
    )
    expect(container.querySelector('[aria-label="Scope actions"]')).toBeNull()
  })

  it('does not render the actions trigger when no onEdit or onDelete', () => {
    const { container } = render(<ScopeCard {...BASE_PROPS} />)
    expect(container.querySelector('[aria-label="Scope actions"]')).toBeNull()
  })
})
