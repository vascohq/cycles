'use client'

// The Kanban view of a pitch (see ADR 0018): the pitch's cards laid out in
// fixed status columns instead of under scopes. Read-only in this slice — drag
// to move a card between columns lands in the next slice (#173). A card's scope
// shows as a colored tag (reusing Scope Color); needle and hill are hidden.

import type { CardStatus } from '@/cycle-liveblocks.config'
import type { OrganizationUser } from '@/lib/users'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { cardStatus, groupCardsByStatus, type CardColumns } from '@/lib/card-engine'
import { resolveTaskAssignee } from '@/lib/task-engine'
import { readableTextColor } from '@/lib/color-engine'
import { UserAvatar } from '@/components/scope-card/assignee-picker'

type BoardCard = {
  id: string
  title: string
  status?: CardStatus
  done: boolean
  scopeTitle: string
  scopeColor: string
  assigneeId?: string
}

const COLUMNS: {
  key: keyof CardColumns<BoardCard>
  label: string
  dot: string
}[] = [
  { key: 'todo', label: 'To do', dot: 'bg-amber-400' },
  { key: 'doing', label: 'Doing', dot: 'bg-blue-500' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-500' },
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
      assigneeId: t.assigneeId,
    }))
  )
}

export function KanbanBoard({
  scopes,
  orgUsers,
}: {
  scopes: ScopeGridDerived[]
  orgUsers: OrganizationUser[]
}) {
  const columns = groupCardsByStatus(toCards(scopes))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(({ key, label, dot }) => (
        <div key={key} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
          <div className="flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="text-sm font-semibold tracking-tight">{label}</span>
            <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-1.5 min-w-5 text-center">
              {columns[key].length}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 min-h-16">
            {columns[key].map((card) => (
              <KanbanCard key={card.id} card={card} orgUsers={orgUsers} />
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

function KanbanCard({
  card,
  orgUsers,
}: {
  card: BoardCard
  orgUsers: OrganizationUser[]
}) {
  const done = cardStatus(card) === 'done'
  const assignee = resolveTaskAssignee(card.assigneeId, orgUsers)

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-shadow flex flex-col gap-2.5">
      <span
        className="self-start text-[11px] font-medium rounded-md px-2 py-0.5"
        style={{
          backgroundColor: card.scopeColor,
          color: readableTextColor(card.scopeColor),
        }}
      >
        {card.scopeTitle}
      </span>
      <p
        className={`text-sm font-medium leading-snug ${
          done ? 'line-through text-muted-foreground' : ''
        }`}
      >
        {card.title}
      </p>
      {assignee.kind !== 'unassigned' && (
        <div className="flex items-center justify-end border-t pt-2">
          {assignee.kind === 'assigned' ? (
            <UserAvatar user={assignee.user} />
          ) : (
            <span className="text-[10px] text-muted-foreground/60">Former member</span>
          )}
        </div>
      )}
    </div>
  )
}
