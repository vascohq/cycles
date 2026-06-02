import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ScopeCard } from './scope-card'

afterEach(cleanup)

const BASE_PROPS = {
  id: 's1',
  order: 1,
  title: 'Auth flow',
  tier: 'must' as const,
  color: '#3e63dd',
  litmus_text: 'Users can log in',
  tasks: [
    { id: 't1', title: 'Login page', done: true },
    { id: 't2', title: 'Token refresh', done: false },
  ],
}

describe('ScopeCard face', () => {
  it('leads with the name and shows what it ships', () => {
    render(<ScopeCard {...BASE_PROPS} />)
    expect(screen.getByText('Auth flow')).toBeTruthy()
    expect(screen.getByText('what it ships')).toBeTruthy()
    expect(screen.getByText('Users can log in')).toBeTruthy()
  })

  it('never shows a task completion count (no "X/Y done")', () => {
    render(<ScopeCard {...BASE_PROPS} />)
    expect(screen.queryByText(/\d+\/\d+ done/)).toBeNull()
  })

  it('shows a non-numeric task presence label when tasks exist', () => {
    render(<ScopeCard {...BASE_PROPS} />)
    expect(screen.getByText('2 tasks')).toBeTruthy()
  })

  it('singularizes the presence label for one task', () => {
    render(
      <ScopeCard {...BASE_PROPS} tasks={[{ id: 't1', title: 'x', done: false }]} />
    )
    expect(screen.getByText('1 task')).toBeTruthy()
  })

  it('renders no presence indicator when there are no tasks', () => {
    render(<ScopeCard {...BASE_PROPS} tasks={[]} />)
    expect(screen.queryByText(/task/)).toBeNull()
  })

  it('does not render the inline task list on the card', () => {
    render(<ScopeCard {...BASE_PROPS} onOpen={vi.fn()} />)
    // Task titles live in the drawer now, not on the card face.
    expect(screen.queryByText('Login page')).toBeNull()
  })
})

describe('opening the drawer', () => {
  it('calls onOpen when the card body is clicked', () => {
    const onOpen = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('Auth flow'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does not open the drawer when the drag handle is clicked', () => {
    const onOpen = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('1')) // order badge / drag handle
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does not open the drawer when the actions menu is clicked', () => {
    const onOpen = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onOpen={onOpen} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Scope actions'))
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('ScopeCard actions menu', () => {
  it('renders the actions trigger when onDelete is provided', () => {
    render(<ScopeCard {...BASE_PROPS} onDelete={vi.fn()} />)
    expect(screen.getByLabelText('Scope actions')).toBeTruthy()
  })

  it('does not render the actions trigger in readOnly mode', () => {
    render(<ScopeCard {...BASE_PROPS} onDelete={vi.fn()} readOnly />)
    expect(screen.queryByLabelText('Scope actions')).toBeNull()
  })

  it('does not render the actions trigger when no onDelete', () => {
    render(<ScopeCard {...BASE_PROPS} />)
    expect(screen.queryByLabelText('Scope actions')).toBeNull()
  })
})
