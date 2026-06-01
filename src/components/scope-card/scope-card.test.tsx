import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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

describe('task edit', () => {
  it('renames a task via the inline editor on Enter, trimming whitespace', () => {
    const onTaskEdit = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onTaskEdit={onTaskEdit} />)

    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: '  Login screen  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onTaskEdit).toHaveBeenCalledWith('t1', 'Login screen')
  })

  it('reverts (no save) when the edited title is emptied', () => {
    const onTaskEdit = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onTaskEdit={onTaskEdit} />)

    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onTaskEdit).not.toHaveBeenCalled()
  })

  it('cancels on Escape without saving', () => {
    const onTaskEdit = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onTaskEdit={onTaskEdit} />)

    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onTaskEdit).not.toHaveBeenCalled()
  })

  it('does not flip done when renaming', () => {
    const onTaskToggle = vi.fn()
    const onTaskEdit = vi.fn()
    render(
      <ScopeCard {...BASE_PROPS} onTaskToggle={onTaskToggle} onTaskEdit={onTaskEdit} />
    )

    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onTaskToggle).not.toHaveBeenCalled()
  })
})

describe('task delete', () => {
  it('deletes a task immediately with no confirm', () => {
    const onTaskDelete = vi.fn()
    render(<ScopeCard {...BASE_PROPS} onTaskDelete={onTaskDelete} />)

    fireEvent.click(screen.getAllByLabelText('Delete task')[0])

    expect(onTaskDelete).toHaveBeenCalledWith('t1')
  })

  it('renders no task edit/delete controls in readOnly mode', () => {
    render(
      <ScopeCard
        {...BASE_PROPS}
        onTaskEdit={vi.fn()}
        onTaskDelete={vi.fn()}
        readOnly
      />
    )
    expect(screen.queryByLabelText('Edit task')).toBeNull()
    expect(screen.queryByLabelText('Delete task')).toBeNull()
  })
})
