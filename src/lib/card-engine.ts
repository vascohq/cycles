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

// Whether every card on a board is done — the trigger for the gold parade
// (#174). False for an empty board (nothing to celebrate). A celebration only,
// never a stage change.
export function areAllCardsDone(
  cards: { status?: CardStatus; done?: boolean }[]
): boolean {
  return cards.length > 0 && cards.every((c) => cardStatus(c) === 'done')
}

// A card's status + title frozen into a Kanban Update, so a since-deleted card
// can still render in the diff (mirrors HillSnapshot freezing title; ADR 0018).
export type CardSnapshotEntry = { taskId: string; status: CardStatus; title: string }

// Cards that reached done since the previous Kanban Update — "what got done".
// The card analogue of the Hill Trail (ADR 0005). On the first update (no prior
// snapshot) every currently-done card counts. A card already done in the prior
// snapshot, or one that regressed out of done, is not included.
export function completedSince(
  previous: CardSnapshotEntry[] | undefined,
  current: CardSnapshotEntry[]
): CardSnapshotEntry[] {
  const wasDone = new Set(
    (previous ?? []).filter((c) => c.status === 'done').map((c) => c.taskId)
  )
  return current.filter((c) => c.status === 'done' && !wasDone.has(c.taskId))
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
