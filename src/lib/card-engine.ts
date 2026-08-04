// Pure logic behind the Kanban view (see ADR 0018). A card is a Task rendered
// as a board item; this module turns a pitch's tasks into status columns and
// derives a card's status without requiring any Liveblocks backfill.

import type { CardStatus, ScopeTask } from '@/cycle-liveblocks.config'

export type { CardStatus }

// A board card: one of the pitch's tasks with its scope's identity resolved.
// Scope is an attribute of a card, not its parent grouping — the board is a
// single ordered list of the pitch's cards, split into columns by status.
export type BoardCard = {
  id: string
  title: string
  done: boolean
  status?: CardStatus
  assigneeId?: string
  /** Absent on an Unscoped (triage) card — it renders untagged. */
  scopeId?: string
  scopeTitle?: string
  scopeColor?: string
}

// The pitch's cards, in board order: the order of the cycle-wide `tasks` list.
// Position within a column is priority (see ADR 0018), so this deliberately
// does NOT group by scope — a card carries its scope as a tag instead.
// A card belongs to the pitch when it sits under one of the pitch's scopes, or
// when it is parented straight to the pitch (Unscoped).
export function deriveBoardCards(
  tasks: ScopeTask[],
  scopes: { id: string; title: string; color?: string }[],
  pitchId: string
): BoardCard[] {
  const scopeById = new Map(scopes.map((s) => [s.id, s]))
  const cards: BoardCard[] = []
  for (const t of tasks) {
    const scope = t.scopeId ? scopeById.get(t.scopeId) : undefined
    if (t.scopeId ? !scope : t.pitchId !== pitchId) continue
    cards.push({
      id: t.id,
      title: t.title,
      done: t.done,
      status: t.status,
      assigneeId: t.assigneeId,
      ...(scope ? { scopeId: scope.id, scopeTitle: scope.title, scopeColor: scope.color } : {}),
    })
  }
  return cards
}

// Where a card lands relative to another card. A reorder is always expressed
// against a visible neighbour (an anchor), never an absolute index: the board
// shows a filtered subset of a cycle-wide list, so "the card above the one I
// see" is the only meaning that survives filtering.
export type CardAnchor = { id: string; placement: 'before' | 'after' }

// The index to pass to LiveList.move so a card ends up immediately
// before/after its anchor. The list removes the element before re-inserting,
// so everything below it shifts up by one — hence the asymmetry when moving
// down (from < anchorIdx) versus up.
export function moveTargetIndex(
  from: number,
  anchorIdx: number,
  placement: CardAnchor['placement']
): number {
  if (placement === 'after') return from < anchorIdx ? anchorIdx : anchorIdx + 1
  return from < anchorIdx ? anchorIdx - 1 : anchorIdx
}

// A card's column. Existing tasks predate the `status` field (they only carry
// the legacy binary `done`), so when `status` is absent we derive it: a done
// task is `done`, anything else is `todo`. No stored migration needed.
export function cardStatus(task: { status?: CardStatus; done?: boolean }): CardStatus {
  if (task.status) return task.status
  return task.done ? 'done' : 'todo'
}

// Whether a status change crosses a card into done — the trigger for the
// per-card confetti pop (#173). True only on the entry edge, so re-dropping a
// done card or moving it back out never celebrates.
export function becameDone(prev: CardStatus, next: CardStatus): boolean {
  return next === 'done' && prev !== 'done'
}

// Whether every card on a board is done — the trigger for the gold parade
// (#174). False for an empty board (nothing to celebrate). A celebration only,
// never a stage change.
export function areAllCardsDone(
  cards: { status?: CardStatus; done?: boolean }[]
): boolean {
  return cards.length > 0 && cards.every((c) => cardStatus(c) === 'done')
}

export type CardColumns<T> = { todo: T[]; doing: T[]; done: T[] }

export const CARD_STATUSES: CardStatus[] = ['todo', 'doing', 'done']

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as string[]).includes(value)
}

// Turn a board drop into "which column, next to which card". `overId` is either
// a column key — dropped on the column's background, so the card lands at the
// bottom, the lowest priority — or the id of the card it was dropped on.
// Columns hold only the *visible* cards, in display order, so a drop resolves
// against what the person dragging can actually see.
// Returns null when the drop changes nothing.
export function resolveCardDrop(
  activeId: string,
  overId: string,
  columns: CardColumns<{ id: string }>
): { status: CardStatus; anchor: CardAnchor | null } | null {
  if (isCardStatus(overId)) {
    const rest = columns[overId].filter((c) => c.id !== activeId)
    const last = rest[rest.length - 1]
    return { status: overId, anchor: last ? { id: last.id, placement: 'after' } : null }
  }
  const status = CARD_STATUSES.find((s) => columns[s].some((c) => c.id === overId))
  if (!status) return null
  const column = columns[status]
  const overIdx = column.findIndex((c) => c.id === overId)
  const activeIdx = column.findIndex((c) => c.id === activeId)
  if (activeIdx === overIdx) return null
  // Within a column, dragging downwards lands the card *after* the one it was
  // dropped on (the list closes up behind it); upwards, before. Coming from
  // another column it takes the hovered card's place and pushes it down.
  const placement = activeIdx !== -1 && activeIdx < overIdx ? 'after' : 'before'
  return { status, anchor: { id: overId, placement } }
}

// Split a pitch's cards into the three Kanban columns, preserving input order
// within each column. Uses `cardStatus`, so legacy `done`-only tasks fall into
// the right column without a migration.
export function groupCardsByStatus<T extends { status?: CardStatus; done?: boolean }>(
  cards: T[]
): CardColumns<T> {
  const columns: CardColumns<T> = { todo: [], doing: [], done: [] }
  for (const card of cards) columns[cardStatus(card)].push(card)
  return columns
}
