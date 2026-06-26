'use client'

// The Kanban view of a pitch (see ADR 0018): the pitch's cards laid out in
// fixed status columns instead of under scopes. Drag a card to another column
// to change its status (#173); dropping into Done pops a little confetti. A
// card's scope shows as a colored tag (reusing Scope Color); needle and hill
// are hidden.

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { CardStatus } from '@/cycle-liveblocks.config'
import type { OrganizationUser } from '@/lib/users'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { cardStatus, groupCardsByStatus, becameDone, type CardColumns } from '@/lib/card-engine'
import { resolveTaskAssignee } from '@/lib/task-engine'
import { readableTextColor } from '@/lib/color-engine'
import { fireTaskDoneConfetti } from '@/lib/confetti'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import { UserMinus } from 'lucide-react'

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
  key: CardStatus
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
  onCardStatusChange,
}: {
  scopes: ScopeGridDerived[]
  orgUsers: OrganizationUser[]
  /** Move a card to a new column. Absent = read-only board (no drag). */
  onCardStatusChange?: (taskId: string, status: CardStatus) => void
}) {
  const cards = toCards(scopes)
  const columns = groupCardsByStatus(cards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || !onCardStatusChange) return
    const target = over.id as CardStatus
    const card = cards.find((c) => c.id === active.id)
    if (!card) return
    const prev = cardStatus(card)
    if (prev === target) return
    onCardStatusChange(card.id, target)
    if (becameDone(prev, target)) {
      const rect = active.rect.current.translated
      if (rect) {
        fireTaskDoneConfetti({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        })
      }
    }
  }

  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <Column
          key={col.key}
          col={col}
          cards={columns[col.key]}
          orgUsers={orgUsers}
          draggable={!!onCardStatusChange}
        />
      ))}
    </div>
  )

  if (!onCardStatusChange) return grid

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {grid}
      {/* The ghost: a lifted copy of the card that tracks the pointer. */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <CardFace card={activeCard} orgUsers={orgUsers} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  col,
  cards,
  orgUsers,
  draggable,
}: {
  col: { key: CardStatus; label: string; dot: string }
  cards: CardColumns<BoardCard>[CardStatus]
  orgUsers: OrganizationUser[]
  draggable: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-xl p-3 transition-colors ${
        isOver ? 'bg-muted/60 ring-1 ring-border' : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
        <span className="text-sm font-semibold tracking-tight">{col.label}</span>
        <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-1.5 min-w-5 text-center">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 min-h-16">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            orgUsers={orgUsers}
            draggable={draggable}
          />
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground/40 px-1 py-2">No cards</p>
        )}
      </div>
    </div>
  )
}

// The draggable card in a column. The source dims while a ghost copy (rendered
// in the DragOverlay) tracks the pointer.
function KanbanCard({
  card,
  orgUsers,
  draggable,
}: {
  card: BoardCard
  orgUsers: OrganizationUser[]
  draggable: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <CardFace card={card} orgUsers={orgUsers} />
    </div>
  )
}

// Presentational card — shared by the in-column card and the drag ghost.
function CardFace({
  card,
  orgUsers,
  dragging = false,
}: {
  card: BoardCard
  orgUsers: OrganizationUser[]
  dragging?: boolean
}) {
  const done = cardStatus(card) === 'done'
  const assignee = resolveTaskAssignee(card.assigneeId, orgUsers)

  return (
    <div
      className={`rounded-lg border bg-card p-3 flex flex-col gap-2.5 transition-shadow ${
        dragging
          ? 'shadow-[0_8px_24px_rgba(0,0,0,0.16)] rotate-2 cursor-grabbing'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.07)]'
      }`}
    >
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
      <div className="flex items-center justify-end border-t pt-2">
        {assignee.kind === 'assigned' ? (
          <UserAvatar user={assignee.user} />
        ) : assignee.kind === 'former_member' ? (
          <span
            title="Former member"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60"
          >
            <UserMinus className="h-3 w-3" />
          </span>
        ) : (
          <span
            title="Unassigned"
            className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40"
          />
        )}
      </div>
    </div>
  )
}
