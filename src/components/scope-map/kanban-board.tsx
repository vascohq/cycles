'use client'

// The Kanban view of a pitch (see ADR 0018): the pitch's cards in fixed status
// columns. Drag a card to another column to change its status (drop into Done
// pops confetti). Cards can be filtered by scope and assignee, edited, assigned,
// deleted, and created inline. A card's scope shows as a colored tag; unscoped
// (triage) cards show untagged.

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
import { Plus, X, Trash2 } from 'lucide-react'
import type { CardStatus } from '@/cycle-liveblocks.config'
import type { OrganizationUser } from '@/lib/users'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { cardStatus, groupCardsByStatus, becameDone, type CardColumns } from '@/lib/card-engine'
import { assigneeFilterOptions } from '@/lib/task-engine'
import { readableTextColor } from '@/lib/color-engine'
import { fireTaskDoneConfetti } from '@/lib/confetti'
import { AssigneePicker } from '@/components/scope-card/assignee-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

// A card on the board. Unscoped (triage) cards omit scopeId.
export type BoardTask = {
  id: string
  title: string
  done: boolean
  status?: CardStatus
  assigneeId?: string
}

type BoardCard = BoardTask & {
  scopeId?: string
  scopeTitle?: string
  scopeColor?: string
}

const UNSCOPED = '__unscoped__'

const COLUMNS: { key: CardStatus; label: string; dot: string }[] = [
  { key: 'todo', label: 'To do', dot: 'bg-amber-400' },
  { key: 'doing', label: 'Doing', dot: 'bg-blue-500' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-500' },
]

function toCards(scopes: ScopeGridDerived[], unscoped: BoardTask[]): BoardCard[] {
  const scoped = scopes.flatMap((s) =>
    s.tasks.map((t) => ({
      ...t,
      scopeId: s.id,
      scopeTitle: s.title,
      scopeColor: s.color,
    }))
  )
  return [...scoped, ...unscoped.map((t) => ({ ...t }))]
}

export function KanbanBoard({
  scopes,
  unscopedTasks = [],
  orgUsers,
  onCardStatusChange,
  onCardEdit,
  onCardAssign,
  onCardDelete,
  onAddCard,
}: {
  scopes: ScopeGridDerived[]
  unscopedTasks?: BoardTask[]
  orgUsers: OrganizationUser[]
  onCardStatusChange?: (taskId: string, status: CardStatus) => void
  onCardEdit?: (taskId: string, title: string) => void
  onCardAssign?: (taskId: string, assigneeId: string | null) => void
  onCardDelete?: (taskId: string) => void
  onAddCard?: (title: string, status: CardStatus) => void
}) {
  const allCards = toCards(scopes, unscopedTasks)
  const [scopeFilter, setScopeFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<BoardCard | null>(null)

  // Filter options self-hide when there's no choice to make.
  const scopeOptions = scopes.map((s) => ({ id: s.id, title: s.title, color: s.color }))
  const assigneeOptions = assigneeFilterOptions(allCards, orgUsers)
  const showScopeFilter = scopeOptions.length > 1 || (scopeOptions.length >= 1 && unscopedTasks.length > 0)
  const showAssigneeFilter = assigneeOptions.length > 1

  const cards = allCards.filter((c) => {
    if (scopeFilter === UNSCOPED && c.scopeId) return false
    if (scopeFilter && scopeFilter !== UNSCOPED && c.scopeId !== scopeFilter) return false
    if (assigneeFilter && c.assigneeId !== assigneeFilter) return false
    return true
  })
  const columns = groupCardsByStatus(cards)
  const activeCard = activeId ? allCards.find((c) => c.id === activeId) ?? null : null

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
    const card = allCards.find((c) => c.id === active.id)
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

  const draggable = !!onCardStatusChange

  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <Column
          key={col.key}
          col={col}
          cards={columns[col.key]}
          orgUsers={orgUsers}
          draggable={draggable}
          onOpen={onCardEdit || onCardDelete ? setEditing : undefined}
          onAssign={onCardAssign}
          onAddCard={onAddCard}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {(showScopeFilter || showAssigneeFilter) && (
        <div className="flex items-center gap-2">
          {showScopeFilter && (
            <FilterDropdown
              label="Scope"
              value={
                scopeFilter === UNSCOPED
                  ? 'Unscoped'
                  : scopeOptions.find((s) => s.id === scopeFilter)?.title ?? null
              }
              onClear={() => setScopeFilter(null)}
            >
              {scopeOptions.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setScopeFilter(s.id)}>
                  <span
                    className="mr-2 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.title}
                </DropdownMenuItem>
              ))}
              {unscopedTasks.length > 0 && (
                <DropdownMenuItem onClick={() => setScopeFilter(UNSCOPED)}>
                  <span className="mr-2 h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/50" />
                  Unscoped
                </DropdownMenuItem>
              )}
            </FilterDropdown>
          )}
          {showAssigneeFilter && (
            <FilterDropdown
              label="Assignee"
              value={assigneeOptions.find((u) => u.userId === assigneeFilter)?.name ?? null}
              onClear={() => setAssigneeFilter(null)}
            >
              {assigneeOptions.map((u) => (
                <DropdownMenuItem key={u.userId} onClick={() => setAssigneeFilter(u.userId)}>
                  {u.name}
                </DropdownMenuItem>
              ))}
            </FilterDropdown>
          )}
        </div>
      )}

      {draggable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {grid}
          <DragOverlay dropAnimation={null}>
            {activeCard ? <CardFace card={activeCard} orgUsers={orgUsers} dragging /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        grid
      )}

      {editing && (
        <EditCardDialog
          card={editing}
          onClose={() => setEditing(null)}
          onEdit={onCardEdit}
          onDelete={onCardDelete}
        />
      )}
    </div>
  )
}

function FilterDropdown({
  label,
  value,
  onClear,
  children,
}: {
  label: string
  value: string | null
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div className="inline-flex items-center rounded border border-border bg-muted text-xs">
      <DropdownMenu>
        <DropdownMenuTrigger className="px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground outline-none">
          {label}
          {value ? <span className="text-foreground">: {value}</span> : ''}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="pr-1.5 pl-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function Column({
  col,
  cards,
  orgUsers,
  draggable,
  onOpen,
  onAssign,
  onAddCard,
}: {
  col: { key: CardStatus; label: string; dot: string }
  cards: CardColumns<BoardCard>[CardStatus]
  orgUsers: OrganizationUser[]
  draggable: boolean
  onOpen?: (card: BoardCard) => void
  onAssign?: (taskId: string, assigneeId: string | null) => void
  onAddCard?: (title: string, status: CardStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-lg p-3 transition-colors ${
        isOver ? 'bg-muted ring-1 ring-border' : 'bg-muted/70'
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
        <span className="text-sm font-semibold tracking-tight">{col.label}</span>
        <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-1.5 min-w-5 text-center">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 min-h-4">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            orgUsers={orgUsers}
            draggable={draggable}
            onOpen={onOpen}
            onAssign={onAssign}
          />
        ))}
      </div>
      {onAddCard && <AddCard status={col.key} onAdd={onAddCard} />}
    </div>
  )
}

function AddCard({
  status,
  onAdd,
}: {
  status: CardStatus
  onAdd: (title: string, status: CardStatus) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function submit() {
    const t = title.trim()
    if (t) onAdd(t, status)
    setTitle('')
    setAdding(false)
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 px-1 py-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add card
      </button>
    )
  }

  return (
    <textarea
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          setTitle('')
          setAdding(false)
        }
      }}
      placeholder="Card title…"
      rows={2}
      className="w-full rounded-lg border bg-card p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
    />
  )
}

function KanbanCard({
  card,
  orgUsers,
  draggable,
  onOpen,
  onAssign,
}: {
  card: BoardCard
  orgUsers: OrganizationUser[]
  draggable: boolean
  onOpen?: (card: BoardCard) => void
  onAssign?: (taskId: string, assigneeId: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable,
  })
  const done = cardStatus(card) === 'done'

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-border bg-card p-3 flex flex-col gap-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] transition-shadow ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {/* Body is the drag handle + click-to-edit; the footer picker is excluded
          so assigning doesn't start a drag. */}
      <div
        {...attributes}
        {...listeners}
        onClick={() => onOpen?.(card)}
        className={`flex flex-col gap-2.5 ${
          draggable ? 'cursor-grab active:cursor-grabbing' : onOpen ? 'cursor-pointer' : ''
        }`}
      >
        {card.scopeTitle && (
          <span
            className="self-start text-[11px] font-medium rounded px-2 py-0.5"
            style={{
              backgroundColor: card.scopeColor,
              color: card.scopeColor ? readableTextColor(card.scopeColor) : undefined,
            }}
          >
            {card.scopeTitle}
          </span>
        )}
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
          {card.title}
        </p>
      </div>
      <div className="flex items-center justify-end border-t pt-2">
        <AssigneePicker
          orgUsers={orgUsers}
          assigneeId={card.assigneeId}
          onAssign={(userId) => onAssign?.(card.id, userId)}
          onClear={() => onAssign?.(card.id, null)}
          readOnly={!onAssign}
        />
      </div>
    </div>
  )
}

// Presentational card — the drag ghost.
function CardFace({
  card,
  orgUsers: _orgUsers,
  dragging = false,
}: {
  card: BoardCard
  orgUsers: OrganizationUser[]
  dragging?: boolean
}) {
  const done = cardStatus(card) === 'done'
  return (
    <div
      className={`rounded-lg border border-border bg-card p-3 flex flex-col gap-2.5 ${
        dragging ? 'shadow-[0_8px_24px_rgba(0,0,0,0.16)] rotate-2 cursor-grabbing' : ''
      }`}
    >
      {card.scopeTitle && (
        <span
          className="self-start text-[11px] font-medium rounded px-2 py-0.5"
          style={{
            backgroundColor: card.scopeColor,
            color: card.scopeColor ? readableTextColor(card.scopeColor) : undefined,
          }}
        >
          {card.scopeTitle}
        </span>
      )}
      <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
        {card.title}
      </p>
    </div>
  )
}

function EditCardDialog({
  card,
  onClose,
  onEdit,
  onDelete,
}: {
  card: BoardCard
  onClose: () => void
  onEdit?: (taskId: string, title: string) => void
  onDelete?: (taskId: string) => void
}) {
  const [title, setTitle] = useState(card.title)

  function save() {
    const t = title.trim()
    if (t && t !== card.title) onEdit?.(card.id, t)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && save()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">Edit card</DialogTitle>
        </DialogHeader>
        <textarea
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
          }}
          readOnly={!onEdit}
          rows={3}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <DialogFooter className="justify-between gap-2 sm:justify-between">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(card.id)
                onClose()
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={save}
            className="px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium"
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
