import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TriageTray } from './triage-tray'

afterEach(cleanup)

const SCOPES = [
  { id: 's1', title: 'Auth', color: '#3e63dd' },
  { id: 's2', title: 'Billing', color: '#e5484d' },
]

describe('TriageTray', () => {
  it('renders a row per unscoped card', () => {
    render(
      <TriageTray
        tasks={[
          { id: 't1', title: 'Wire the webhook' },
          { id: 't2', title: 'Fix the redirect' },
        ]}
        scopes={SCOPES}
        onAssignScope={vi.fn()}
      />
    )
    expect(screen.getByText('Wire the webhook')).toBeInTheDocument()
    expect(screen.getByText('Fix the redirect')).toBeInTheDocument()
    expect(screen.getByText('2 unscoped cards')).toBeInTheDocument()
  })

  it('self-hides when there are no unscoped cards', () => {
    const { container } = render(
      <TriageTray tasks={[]} scopes={SCOPES} onAssignScope={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('assigns a card to the chosen scope', async () => {
    const user = userEvent.setup()
    const onAssignScope = vi.fn()
    render(
      <TriageTray
        tasks={[{ id: 't1', title: 'Wire the webhook' }]}
        scopes={SCOPES}
        onAssignScope={onAssignScope}
      />
    )
    await user.click(screen.getByText('Assign to scope'))
    await user.click(await screen.findByRole('menuitem', { name: 'Billing' }))
    expect(onAssignScope).toHaveBeenCalledWith('t1', 's2')
  })
})
