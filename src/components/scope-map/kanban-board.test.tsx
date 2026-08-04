import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KanbanBoard, type BoardCard } from './kanban-board'

afterEach(cleanup)

const SCOPES = [
  { id: 's1', title: 'Auth', color: '#3e63dd' },
  { id: 's2', title: 'Billing', color: '#e5484d' },
]

// Cards as they arrive from deriveBoardCards: one flat list in priority order,
// scopes intermixed (see ADR 0018).
const CARDS: BoardCard[] = [
  { id: 't1', title: 'Highest', done: false, status: 'todo', scopeId: 's2', scopeTitle: 'Billing', scopeColor: '#e5484d' },
  { id: 't2', title: 'Middle', done: false, status: 'todo' },
  { id: 't3', title: 'Lowest', done: false, status: 'todo', scopeId: 's1', scopeTitle: 'Auth', scopeColor: '#3e63dd' },
  { id: 't4', title: 'In flight', done: false, status: 'doing', scopeId: 's1', scopeTitle: 'Auth', scopeColor: '#3e63dd' },
]

function column(label: string) {
  // The column heading's nearest container holds that column's cards.
  return screen.getByText(label).closest('div')!.parentElement!
}

describe('KanbanBoard', () => {
  it('renders a column top-to-bottom in the order the cards arrive, not grouped by scope', () => {
    render(<KanbanBoard cards={CARDS} scopeOptions={SCOPES} orgUsers={[]} onCardMove={vi.fn()} />)
    const todo = column('To do')
    const titles = ['Highest', 'Middle', 'Lowest'].map((t) => within(todo).getByText(t))
    // Document order matches priority order.
    expect(titles[0].compareDocumentPosition(titles[1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(titles[1].compareDocumentPosition(titles[2])).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(column('Doing')).getByText('In flight')).toBeInTheDocument()
  })

  it('counts the cards in each column', () => {
    render(<KanbanBoard cards={CARDS} scopeOptions={SCOPES} orgUsers={[]} />)
    expect(within(column('To do')).getByText('3')).toBeInTheDocument()
    expect(within(column('Doing')).getByText('1')).toBeInTheDocument()
    expect(within(column('Done')).getByText('0')).toBeInTheDocument()
  })

  it('offers the Unscoped scope filter only while an untagged card exists', async () => {
    const user = userEvent.setup()
    render(<KanbanBoard cards={CARDS.filter((c) => c.scopeId)} scopeOptions={SCOPES} orgUsers={[]} />)
    await user.click(screen.getByText('Scope'))
    expect(screen.queryByRole('menuitem', { name: 'Unscoped' })).not.toBeInTheDocument()
    cleanup()

    render(<KanbanBoard cards={CARDS} scopeOptions={SCOPES} orgUsers={[]} />)
    await user.click(screen.getByText('Scope'))
    expect(screen.getByRole('menuitem', { name: 'Unscoped' })).toBeInTheDocument()
  })
})
