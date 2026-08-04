import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { KanbanBoard } from './kanban-board'
import { moveTargetIndex, type BoardCard, type CardAnchor, type CardStatus } from '@/lib/card-engine'

const meta = {
  title: 'ScopeMap/KanbanBoard',
  component: KanbanBoard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof KanbanBoard>

export default meta
type Story = StoryObj<typeof meta>

const SCOPES = [
  { id: 's1', title: 'Auth', color: '#3e63dd' },
  { id: 's2', title: 'Billing', color: '#e5484d' },
]

const CARDS: BoardCard[] = [
  { id: 't1', title: 'Highest', done: false, status: 'todo', scopeId: 's2', scopeTitle: 'Billing', scopeColor: '#e5484d' },
  { id: 't2', title: 'Middle', done: false, status: 'todo' },
  { id: 't3', title: 'Lowest', done: false, status: 'todo', scopeId: 's1', scopeTitle: 'Auth', scopeColor: '#3e63dd' },
  { id: 't4', title: 'In flight', done: false, status: 'doing', scopeId: 's1', scopeTitle: 'Auth', scopeColor: '#3e63dd' },
]

// Stand-in for the Liveblocks mutation: the same anchor → index math the real
// one uses (moveTargetIndex over the flat list), so the story reorders exactly
// like the app does.
function applyMove(
  cards: BoardCard[],
  id: string,
  status: CardStatus,
  anchor: CardAnchor | null
): BoardCard[] {
  const next = cards.map((c) => (c.id === id ? { ...c, status, done: status === 'done' } : c))
  if (!anchor) return next
  const from = next.findIndex((c) => c.id === id)
  const anchorIdx = next.findIndex((c) => c.id === anchor.id)
  if (from === -1 || anchorIdx === -1) return next
  const [card] = next.splice(from, 1)
  next.splice(moveTargetIndex(from, anchorIdx, anchor.placement), 0, card)
  return next
}

function BoardHarness() {
  const [cards, setCards] = useState(CARDS)
  return (
    <KanbanBoard
      cards={cards}
      scopeOptions={SCOPES}
      orgUsers={[]}
      onCardMove={(id, status, anchor) =>
        setCards((prev) => applyMove(prev, id, status, anchor))
      }
    />
  )
}

// The card element that carries the drag listeners (the title's ancestor).
function cardOf(title: HTMLElement) {
  return title.closest('[role="button"], div[tabindex]') ?? title.parentElement!
}

function center(el: Element) {
  const r = el.getBoundingClientRect()
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
}

// Drive a real pointer drag: press, cross the 5px activation threshold, step
// onto the target, release.
async function drag(source: Element, target: Element) {
  const from = center(source)
  const to = center(target)
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: source, coords: from },
    { target: source, coords: { clientX: from.clientX, clientY: from.clientY + 8 } },
    { target, coords: { clientX: to.clientX, clientY: to.clientY - 4 } },
    { target, coords: to },
    { keys: '[/MouseLeft]', target, coords: to },
  ])
}

function titles(container: HTMLElement, columnLabel: string) {
  const column = within(container).getByText(columnLabel).closest('div')!.parentElement!
  return [...column.querySelectorAll('p')].map((p) => p.textContent)
}

export const Default: Story = {
  args: { cards: CARDS, scopeOptions: SCOPES, orgUsers: [] },
  render: () => <BoardHarness />,
}

// Order within a column is priority — dragging a card up must promote it.
export const DragToReprioritise: Story = {
  args: { cards: CARDS, scopeOptions: SCOPES, orgUsers: [] },
  render: () => <BoardHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(titles(canvasElement, 'To do')).toEqual(['Highest', 'Middle', 'Lowest'])

    await drag(cardOf(canvas.getByText('Lowest')), cardOf(canvas.getByText('Highest')))

    expect(titles(canvasElement, 'To do')).toEqual(['Lowest', 'Highest', 'Middle'])
  },
}

// Dropping on a column's background moves the card there at the bottom — the
// lowest priority.
export const DragAcrossColumns: Story = {
  args: { cards: CARDS, scopeOptions: SCOPES, orgUsers: [] },
  render: () => <BoardHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const doingColumn = canvas.getByText('Doing').closest('div')!.parentElement!

    await drag(cardOf(canvas.getByText('Middle')), doingColumn)

    expect(titles(canvasElement, 'To do')).toEqual(['Highest', 'Lowest'])
    expect(titles(canvasElement, 'Doing')).toEqual(['In flight', 'Middle'])
  },
}
