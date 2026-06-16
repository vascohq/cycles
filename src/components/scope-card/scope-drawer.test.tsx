import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ScopeDrawer } from './scope-drawer'

afterEach(cleanup)

const SCOPE = {
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

function renderDrawer(props: Partial<React.ComponentProps<typeof ScopeDrawer>> = {}) {
  return render(
    <ScopeDrawer open onOpenChange={vi.fn()} scope={SCOPE} {...props} />
  )
}

describe('scope field editing', () => {
  it('saves a renamed scope on Enter, trimming whitespace', () => {
    const onEditScope = vi.fn()
    renderDrawer({ onEditScope })
    fireEvent.click(screen.getByText('Auth flow'))
    const input = screen.getByDisplayValue('Auth flow')
    fireEvent.change(input, { target: { value: '  Auth & SSO  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEditScope).toHaveBeenCalledWith({ title: 'Auth & SSO' })
  })

  it('saves an edited "what it ships" on Enter', () => {
    const onEditScope = vi.fn()
    renderDrawer({ onEditScope })
    fireEvent.click(screen.getByText('Users can log in'))
    const input = screen.getByDisplayValue('Users can log in')
    fireEvent.change(input, { target: { value: 'Users can log in with SSO' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEditScope).toHaveBeenCalledWith({ litmus_text: 'Users can log in with SSO' })
  })

  it('reverts an emptied field without saving', () => {
    const onEditScope = vi.fn()
    renderDrawer({ onEditScope })
    fireEvent.click(screen.getByText('Auth flow'))
    const input = screen.getByDisplayValue('Auth flow')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEditScope).not.toHaveBeenCalled()
  })

  it('changes tier immediately when a tier is picked', () => {
    const onEditScope = vi.fn()
    renderDrawer({ onEditScope })
    fireEvent.click(screen.getByRole('button', { name: 'could' }))
    expect(onEditScope).toHaveBeenCalledWith({ tier: 'could' })
  })
})

describe('core scope toggle', () => {
  it('flags the scope as core when toggled on', () => {
    const onToggleCore = vi.fn()
    renderDrawer({ onToggleCore })
    fireEvent.click(screen.getByRole('button', { name: /core scope/i }))
    expect(onToggleCore).toHaveBeenCalledWith(true)
  })

  it('clears the core flag when toggled off', () => {
    const onToggleCore = vi.fn()
    renderDrawer({ onToggleCore, scope: { ...SCOPE, isCore: true } })
    fireEvent.click(screen.getByRole('button', { name: /core scope/i }))
    expect(onToggleCore).toHaveBeenCalledWith(false)
  })
})

describe('task management in the drawer', () => {
  it('renames a task via the inline editor on Enter', () => {
    const onTaskEdit = vi.fn()
    renderDrawer({ onTaskEdit })
    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: 'Login screen' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTaskEdit).toHaveBeenCalledWith('t1', 'Login screen')
  })

  it('inserts a newline instead of saving when Shift+Enter is pressed during a task rename', () => {
    const onTaskEdit = vi.fn()
    renderDrawer({ onTaskEdit })
    fireEvent.click(screen.getAllByLabelText('Edit task')[0])
    const input = screen.getByDisplayValue('Login page')
    fireEvent.change(input, { target: { value: 'Login page, then redirect home' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onTaskEdit).not.toHaveBeenCalled()
  })

  it('deletes a task immediately with no confirm', () => {
    const onTaskDelete = vi.fn()
    renderDrawer({ onTaskDelete })
    fireEvent.click(screen.getAllByLabelText('Delete task')[0])
    expect(onTaskDelete).toHaveBeenCalledWith('t1')
  })

  it('toggles a task done', () => {
    const onTaskToggle = vi.fn()
    renderDrawer({ onTaskToggle })
    fireEvent.click(screen.getByText('Token refresh'))
    expect(onTaskToggle).toHaveBeenCalledWith('t2', true)
  })

  it('shows reset only when at least one task is done', () => {
    const { rerender } = renderDrawer({ onReset: vi.fn() })
    expect(screen.getByText('reset')).toBeTruthy()
    rerender(
      <ScopeDrawer
        open
        onOpenChange={vi.fn()}
        onReset={vi.fn()}
        scope={{ ...SCOPE, tasks: [{ id: 't2', title: 'x', done: false }] }}
      />
    )
    expect(screen.queryByText('reset')).toBeNull()
  })
})

describe('readOnly drawer', () => {
  it('does not save edits or expose task controls', () => {
    const onEditScope = vi.fn()
    renderDrawer({ onEditScope, onTaskEdit: vi.fn(), onTaskDelete: vi.fn(), readOnly: true })
    fireEvent.click(screen.getByText('Auth flow'))
    expect(screen.queryByDisplayValue('Auth flow')).toBeNull()
    expect(screen.queryByLabelText('Edit task')).toBeNull()
    expect(screen.queryByLabelText('Delete task')).toBeNull()
  })
})
