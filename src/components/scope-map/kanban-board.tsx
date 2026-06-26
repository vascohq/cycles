'use client'

// The Kanban view of a pitch (see ADR 0018): the pitch's cards laid out in
// fixed status columns instead of under scopes. Read-only in this slice — drag
// to move a card between columns lands in the next slice (#173). A card's scope
// shows as a colored tag (reusing Scope Color); needle and hill are hidden.

import type { CardStatus } from '@/cycle-liveblocks.config'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { cardStatus, groupCardsByStatus, type CardColumns } from '@/lib/card-engine'
import { readableTextColor } from '@/lib/color-engine'

type BoardCard = {
  id: string
  title: string
  status?: CardStatus
  done: boolean
  scopeTitle: string
  scopeColor: string
}

const COLUMNS: { key: keyof CardColumns<BoardCard>; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

// Flatten every scope's tasks into one card list, tagging each with its scope's
// identity so the board can render the tag. Order follows scope order, then task
// order within a scope — the same order the Scope Map shows.
function toCards(scopes: ScopeGridDerived[]): BoardCard[] {
  return scopes.flatMap((s) =>
    s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      done: t.done,
      scopeTitle: s.title,
      scopeColor: s.color,
    }))
  )
}

export function KanbanBoard({ scopes }: { scopes: ScopeGridDerived[] }) {
  const columns = groupCardsByStatus(toCards(scopes))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {label}
            <span className="text-xs font-normal text-muted-foreground/60">
              {columns[key].length}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2 min-h-24">
            {columns[key].map((card) => (
              <KanbanCard key={card.id} card={card} />
            ))}
            {columns[key].length === 0 && (
              <p className="text-xs text-muted-foreground/40 px-1 py-2">No cards</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function KanbanCard({ card }: { card: BoardCard }) {
  const done = cardStatus(card) === 'done'
  return (
    <div className="rounded-md border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-2">
      <p className={`text-sm leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
        {card.title}
      </p>
      <span
        className="self-start text-[11px] font-medium rounded-full px-2 py-0.5"
        style={{ backgroundColor: card.scopeColor, color: readableTextColor(card.scopeColor) }}
      >
        {card.scopeTitle}
      </span>
    </div>
  )
}
