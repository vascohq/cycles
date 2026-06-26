// Pure logic behind the Kanban view (see ADR 0018). A card is a Task rendered
// as a board item; this module turns a pitch's tasks into status columns and
// derives a card's status without requiring any Liveblocks backfill.

import type { CardStatus } from '@/cycle-liveblocks.config'

export type { CardStatus }

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

export type CardColumns<T> = { todo: T[]; doing: T[]; done: T[] }

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
