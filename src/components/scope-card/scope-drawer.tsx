'use client'

import { useState, useRef, useLayoutEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tier } from '@/cycle-liveblocks.config'
import { readableTextColor } from '@/lib/color-engine'
import { Check, Plus, Pencil, Star, MoreHorizontal, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { ColorPicker } from '@/components/color-picker'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { ScopeCardTask } from './scope-card'
import type { OrganizationUser } from '@/lib/users'
import { fireTaskDoneConfetti } from '@/lib/confetti'
import { AssigneePicker, UserAvatar } from './assignee-picker'
import { filterTasks, assigneeFilterOptions } from '@/lib/task-engine'

const TIERS: Tier[] = ['must', 'should', 'could']

export type ScopeDrawerScope = {
  id: string
  order: number
  title: string
  tier: Tier
  color: string
  litmus_text: string
  /** True when this scope is the pitch's Core Scope (see ADR 0012). */
  isCore?: boolean
  tasks: ScopeCardTask[]
}

export type ScopeDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: ScopeDrawerScope | null
  /** Colors used by sibling scopes — flagged "in use" in the picker. */
  usedColors?: string[]
  onEditScope?: (
    fields: { title?: string; tier?: Tier; litmus_text?: string; color?: string }
  ) => void
  /** Flag (true) or clear (false) this scope as the pitch's Core Scope. */
  onToggleCore?: (next: boolean) => void
  onTaskToggle?: (taskId: string, done: boolean) => void
  onTaskEdit?: (taskId: string, title: string) => void
  onTaskDelete?: (taskId: string) => void
  /** Set (userId) or clear (null) a task's assignee. */
  onTaskAssign?: (taskId: string, assigneeId: string | null) => void
  /** Reorder: move task activeId to overId's position. */
  onTaskReorder?: (activeId: string, overId: string) => void
  onAddTask?: (title: string) => void
  /** The cycle's org members, for the per-task assignee picker/avatars. */
  orgUsers?: OrganizationUser[]
  readOnly?: boolean
}

// The single editor for one scope. Name, tier and "what it ships" are
// inline-edited with auto-save (Enter/blur saves, Esc reverts) to match the
// task-row pattern and the real-time Liveblocks model — there is no Save button.
export function ScopeDrawer({
  open,
  onOpenChange,
  scope,
  usedColors,
  onEditScope,
  onToggleCore,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onTaskAssign,
  onTaskReorder,
  onAddTask,
  orgUsers,
  readOnly,
}: ScopeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* A floating island on the right: 4px inset all sides, 8px radius, wider
          than the default sheet. Overrides the base SheetContent's flush
          inset-y-0/right-0/h-full/border-l via tailwind-merge. */}
      <SheetContent className="gap-0 overflow-y-auto top-1 bottom-1 right-1 h-auto w-[calc(100%-0.5rem)] max-w-xl rounded-lg border shadow-xl">
        {scope && (
          <ScopeDrawerBody
            scope={scope}
            usedColors={usedColors}
            onEditScope={onEditScope}
            onToggleCore={onToggleCore}
            onTaskToggle={onTaskToggle}
            onTaskEdit={onTaskEdit}
            onTaskDelete={onTaskDelete}
            onTaskAssign={onTaskAssign}
            onTaskReorder={onTaskReorder}
            onAddTask={onAddTask}
            orgUsers={orgUsers}
            readOnly={readOnly}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ScopeDrawerBody({
  scope,
  usedColors = [],
  onEditScope,
  onToggleCore,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onTaskAssign,
  onTaskReorder,
  onAddTask,
  orgUsers = [],
  readOnly,
}: Omit<ScopeDrawerProps, 'open' | 'onOpenChange' | 'scope'> & {
  scope: ScopeDrawerScope
}) {
  // Drawer-local view filters — ephemeral per-viewer state, never Liveblocks
  // (a filter must not move on a collaborator's screen). State lives here, so it
  // resets when the drawer closes and the body unmounts.
  // Default to Open — focus on what's left to do; done tasks are one click away
  // via the All toggle. Resets each time the drawer opens (state unmounts).
  const [openOnly, setOpenOnly] = useState(true)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const assigneeOptions = assigneeFilterOptions(scope.tasks, orgUsers)
  const visibleTasks = filterTasks(scope.tasks, {
    openOnly,
    assigneeId: assigneeFilter ?? undefined,
  })

  // Reordering operates on the full list, so it's only unambiguous when the
  // list is unfiltered — a filtered subset can't map positions back cleanly.
  const isFiltered = openOnly || assigneeFilter !== null
  const canReorder =
    !readOnly && !!onTaskReorder && !isFiltered && visibleTasks.length > 1

  // The task currently being dragged — rendered as a fixed-size clone in a
  // DragOverlay so its wrapping title can't reflow ("squish") mid-drag.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const draggingTask = visibleTasks.find((t) => t.id === draggingId) ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      onTaskReorder?.(String(active.id), String(over.id))
    }
  }

  // Props shared by every task row, bound to the task id.
  const rowProps = (task: ScopeCardTask) => ({
    task,
    orgUsers,
    readOnly,
    onToggle: onTaskToggle ? () => onTaskToggle(task.id, !task.done) : undefined,
    onEdit: onTaskEdit ? (title: string) => onTaskEdit(task.id, title) : undefined,
    onDelete: onTaskDelete ? () => onTaskDelete(task.id) : undefined,
    onAssign: onTaskAssign
      ? (assigneeId: string | null) => onTaskAssign(task.id, assigneeId)
      : undefined,
  })

  return (
    <>
      <SheetHeader className="pr-8">
        <div className="flex items-center gap-2">
          <ColorBadge
            order={scope.order}
            color={scope.color}
            usedColors={usedColors}
            onPick={!readOnly && onEditScope ? (color) => onEditScope({ color }) : undefined}
          />
          <SheetTitle className="sr-only">Scope</SheetTitle>
          <SheetDescription className="sr-only">
            Edit the scope name, tier, color, what it ships, and its tasks.
          </SheetDescription>
          <TierControl
            tier={scope.tier}
            readOnly={readOnly}
            onChange={(tier) => onEditScope?.({ tier })}
          />
          {!readOnly && onToggleCore && (
            <CoreToggle
              isCore={!!scope.isCore}
              onToggle={() => onToggleCore(!scope.isCore)}
            />
          )}
        </div>
      </SheetHeader>

      {/* Name */}
      <EditableText
        value={scope.title}
        placeholder="Scope name…"
        readOnly={readOnly}
        multiline={false}
        onSave={(title) => onEditScope?.({ title })}
        className="mt-4 text-lg font-semibold leading-snug tracking-tight"
      />

      {/* What it ships (litmus) — the fuller framing lives here, where there's room */}
      <div className="mt-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          what it ships
        </p>
        <p className="text-[13px] text-muted-foreground/70 mb-1.5 leading-snug">
          If we only ship this scope, what does the user get — and is it useful?
        </p>
        <EditableText
          value={scope.litmus_text}
          placeholder="If we only ship this scope, what does the user get — and is it useful?"
          readOnly={readOnly}
          multiline
          onSave={(litmus_text) => onEditScope?.({ litmus_text })}
          className="text-sm text-foreground leading-snug"
        />
      </div>

      {/* Tasks */}
      <div className="mt-6 flex-1">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          tasks
        </p>

        {scope.tasks.length > 0 && (
          <TaskFilterBar
            openOnly={openOnly}
            onSetOpenOnly={setOpenOnly}
            assigneeOptions={assigneeOptions}
            assigneeFilter={assigneeFilter}
            onPickAssignee={setAssigneeFilter}
          />
        )}

        <div className="flex flex-col gap-1">
          {canReorder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setDraggingId(String(e.active.id))}
              onDragCancel={() => setDraggingId(null)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleTasks.map((task) => (
                  <SortableTaskRow key={task.id} {...rowProps(task)} />
                ))}
              </SortableContext>
              <DragOverlay>
                {draggingTask && <TaskRow {...rowProps(draggingTask)} overlay />}
              </DragOverlay>
            </DndContext>
          ) : (
            visibleTasks.map((task) => <TaskRow key={task.id} {...rowProps(task)} />)
          )}

          {scope.tasks.length === 0 && (
            <p className="text-xs text-muted-foreground/50 py-1">No tasks yet.</p>
          )}

          {scope.tasks.length > 0 && visibleTasks.length === 0 && (
            <p className="text-xs text-muted-foreground/50 py-1">
              No matching tasks.
            </p>
          )}

          {onAddTask && !readOnly && <AddTaskInput onAddTask={onAddTask} />}
        </div>
      </div>
    </>
  )
}

// Click-to-edit text. Enter saves (Shift+Enter for a newline when multiline),
// blur saves, Esc reverts. Empty input reverts to the previous value.
function EditableText({
  value,
  placeholder,
  readOnly,
  multiline,
  onSave,
  className = '',
}: {
  value: string
  placeholder: string
  readOnly?: boolean
  multiline: boolean
  onSave?: (value: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function start() {
    if (readOnly || !onSave) return
    setDraft(value)
    setEditing(true)
  }

  function save() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave?.(trimmed)
    setEditing(false)
  }

  if (editing && onSave) {
    const shared = {
      value: draft,
      autoFocus: true,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setDraft(e.target.value),
      onBlur: save,
      onFocus: (
        e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => e.currentTarget.select(),
      className: `w-full bg-transparent border-b border-foreground/30 outline-none resize-none ${className}`,
    }
    if (multiline) {
      return (
        <textarea
          {...shared}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
      )
    }
    return (
      <input
        {...shared}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={readOnly || !onSave}
      className={`group/edit text-left w-full ${readOnly || !onSave ? 'cursor-default' : 'cursor-text hover:bg-muted/40 rounded -mx-1 px-1 transition-colors'} ${className}`}
    >
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="text-muted-foreground/40">{placeholder}</span>
      )}
      {!readOnly && onSave && (
        <Pencil className="inline-block w-3 h-3 ml-1.5 align-baseline opacity-0 group-hover/edit:opacity-40 transition-opacity" />
      )}
    </button>
  )
}

// Flags this scope as the pitch's single Core Scope. Setting it steals the flag
// from any other scope (one heart, moved — see ADR 0012); the toggle reflects
// the current state with a filled star.
function CoreToggle({
  isCore,
  onToggle,
}: {
  isCore: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={isCore}
      onClick={onToggle}
      title="The heart of the pitch — the slice you build first to prove the idea and surface risk early"
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${
        isCore
          ? 'border-amber-400/50 bg-amber-400/10 text-amber-600 font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Star
        className={`w-3 h-3 ${isCore ? 'fill-amber-400 text-amber-400' : ''}`}
      />
      Core scope
    </button>
  )
}

// The scope's order/identity badge in the header doubles as the color picker —
// click it to recolor from a popover (saves the full COLOR row of space). A
// controlled DropdownMenu (dialog-safe inside the drawer Sheet) closes on pick.
function ColorBadge({
  order,
  color,
  usedColors,
  onPick,
}: {
  order: number
  color: string
  usedColors: string[]
  onPick?: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const badge = (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ backgroundColor: color, color: readableTextColor(color) }}
    >
      {order}
    </span>
  )

  if (!onPick) return badge

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Change scope color"
        title="Change color"
        className="rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2">
        <ColorPicker
          value={color}
          usedColors={usedColors}
          onPick={(c) => {
            onPick(c)
            setOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TierControl({
  tier,
  readOnly,
  onChange,
}: {
  tier: Tier
  readOnly?: boolean
  onChange: (tier: Tier) => void
}) {
  if (readOnly) {
    return (
      <span className="text-xs font-medium text-muted-foreground capitalize">
        {tier}
      </span>
    )
  }
  // Monochrome segmented control — the selected tier fills with foreground, not
  // a hue, so it never competes with the scope's identity color (see ADR 0008).
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {TIERS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-2 py-0.5 text-xs rounded capitalize transition-colors ${
            t === tier
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// Char index of the caret at a viewport point — used to land the cursor where
// the user clicked when opening the inline title editor. Browser-prefixed APIs;
// returns null when unavailable (caller falls back to end-of-text).
function caretIndexFromPoint(x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  if (range) return range.startOffset
  const pos = doc.caretPositionFromPoint?.(x, y)
  if (pos) return pos.offset
  return null
}

// Sortable wrapper: provides the dnd transform on an outer node and passes the
// drag listeners down to the row's grip handle (so dragging starts from the
// grip, not from the title/square/assignee controls).
function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
    >
      <TaskRow {...props} dragHandleProps={listeners} isDragging={isDragging} />
    </div>
  )
}

type TaskRowProps = {
  task: ScopeCardTask
  orgUsers?: OrganizationUser[]
  readOnly?: boolean
  onToggle?: () => void
  onEdit?: (title: string) => void
  onDelete?: () => void
  onAssign?: (assigneeId: string | null) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isDragging?: boolean
  /** Rendered inside the DragOverlay — a lifted, fixed-size clone. */
  overlay?: boolean
}

// A single task line: [grip] [done-square] [title] [assignee] [⋯]. Only the
// square toggles done. Clicking the title opens a seamless inline editor (a
// textarea styled to match the read text exactly). Delete lives in the ⋯ menu to
// the right of the assignee. The grip (drag handle) only appears when reordering
// is enabled. Enter saves, Shift+Enter newline, Esc/empty reverts.
function TaskRow({
  task,
  orgUsers = [],
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  onAssign,
  dragHandleProps,
  isDragging,
  overlay,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.title)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Where to put the caret when entering edit — the char index under the click,
  // so the cursor blinks where you clicked rather than selecting everything.
  const caretRef = useRef<number | null>(null)

  // Typography shared by the read span and the edit textarea so the transition
  // between them is invisible (no visible "it's a textarea" box).
  const titleType = 'min-w-0 flex-1 text-sm leading-snug break-words whitespace-normal'

  // Auto-grow the textarea to its content height — no scrollbar, no fixed rows,
  // so it occupies the same space as the wrapped read text.
  useLayoutEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, value])

  // Place the caret at the clicked character (not a select-all) on entering edit.
  useLayoutEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    const at =
      caretRef.current == null
        ? el.value.length
        : Math.min(caretRef.current, el.value.length)
    el.setSelectionRange(at, at)
    caretRef.current = null
  }, [editing])

  function startEdit(e: React.MouseEvent) {
    if (readOnly || !onEdit) return
    caretRef.current = caretIndexFromPoint(e.clientX, e.clientY)
    setValue(task.title)
    setEditing(true)
  }

  function save() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== task.title) onEdit?.(trimmed)
    setEditing(false)
  }

  return (
    <div
      className={`relative flex items-start gap-2 rounded-md py-1 transition-colors ${
        overlay
          ? 'px-2 bg-popover shadow-lg cursor-grabbing'
          : readOnly
            ? '-mx-2 px-2'
            : 'group -mx-2 px-2 hover:bg-muted dark:hover:bg-muted/50'
      } ${isDragging && !overlay ? 'opacity-40' : ''}`}
    >
      {/* Drag handle — pulled out of flow into the left gutter (absolute) so it
          never shifts the checkbox, which stays aligned with the filter bar
          above. Only present when reordering is enabled; dragging starts here so
          it never fights click-to-edit / toggle / assignee. */}
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Drag to reorder task"
          {...dragHandleProps}
          className="absolute left-0 top-1.5 -translate-x-full cursor-grab touch-none text-muted-foreground/30 opacity-0 transition-opacity hover:text-muted-foreground active:cursor-grabbing group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* The square is the ONLY done toggle. Checking it pops a little confetti. */}
      <button
        type="button"
        aria-label={task.done ? 'Mark task not done' : 'Mark task done'}
        {...(!readOnly && onToggle
          ? {
              onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                // Celebrate only when checking (not un-checking), bursting from
                // the checkbox's screen position.
                if (!task.done) {
                  const r = e.currentTarget.getBoundingClientRect()
                  fireTaskDoneConfetti({
                    x: (r.left + r.width / 2) / window.innerWidth,
                    y: (r.top + r.height / 2) / window.innerHeight,
                  })
                }
                onToggle()
              },
            }
          : { disabled: true })}
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          task.done
            ? 'bg-foreground/10 border-foreground/20'
            : readOnly
              ? 'border-foreground/20'
              : 'border-foreground/20 group-hover:border-foreground/40'
        }`}
      >
        {task.done && <Check className="w-3 h-3 text-foreground/60" />}
      </button>

      {/* Title: click to edit; the textarea matches the read text seamlessly. */}
      {editing && onEdit ? (
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setValue(task.title)
              setEditing(false)
            }
          }}
          onBlur={save}
          className={`${titleType} bg-transparent border-0 p-0 m-0 outline-none resize-none overflow-hidden text-foreground`}
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          disabled={readOnly || !onEdit}
          className={`${titleType} text-left ${
            task.done ? 'line-through text-muted-foreground/60' : 'text-foreground'
          } ${readOnly || !onEdit ? 'cursor-default' : 'cursor-text'}`}
        >
          {task.title}
        </button>
      )}

      {onAssign ? (
        <AssigneePicker
          orgUsers={orgUsers}
          assigneeId={task.assigneeId}
          onAssign={(userId) => onAssign(userId)}
          onClear={() => onAssign(null)}
          readOnly={readOnly}
        />
      ) : (
        task.assigneeId && (
          <AssigneePicker
            orgUsers={orgUsers}
            assigneeId={task.assigneeId}
            onAssign={() => {}}
            onClear={() => {}}
            readOnly
          />
        )
      )}

      {/* Overflow menu to the right of the assignee — holds Delete. */}
      {!readOnly && onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Task actions"
            className="-mr-1.5 mt-0.5 flex-shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => onDelete()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// Drawer-local task filters, always present (so the controls are predictable):
// a labelled All/Open segmented control on the left, and an assignee dropdown on
// the right showing the current selection. Open = not done (never "active").
function TaskFilterBar({
  openOnly,
  onSetOpenOnly,
  assigneeOptions,
  assigneeFilter,
  onPickAssignee,
}: {
  openOnly: boolean
  onSetOpenOnly: (openOnly: boolean) => void
  assigneeOptions: OrganizationUser[]
  assigneeFilter: string | null
  onPickAssignee: (userId: string | null) => void
}) {
  const selected = assigneeOptions.find((u) => u.userId === assigneeFilter)

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      {/* Segmented All | Open — the active segment fills, so the two states and
          which one is on are obvious at a glance. */}
      <div className="inline-flex rounded-md border p-0.5 text-xs">
        {([['All', false], ['Open', true]] as const).map(([label, value]) => (
          <button
            key={label}
            type="button"
            aria-pressed={openOnly === value}
            onClick={() => onSetOpenOnly(value)}
            className={`rounded px-2.5 py-0.5 transition-colors ${
              openOnly === value
                ? 'bg-foreground text-background font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Assignee filter — a dropdown labelled by the current selection. */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {selected ? (
            <>
              <UserAvatar user={selected} className="h-4 w-4" />
              <span className="truncate max-w-24">{selected.name}</span>
            </>
          ) : (
            <span>Everyone</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => onPickAssignee(null)}
            className={!assigneeFilter ? 'bg-muted' : ''}
          >
            Everyone
          </DropdownMenuItem>
          {assigneeOptions.map((user) => (
            <DropdownMenuItem
              key={user.userId}
              onSelect={() => onPickAssignee(user.userId)}
              className={`gap-2 ${user.userId === assigneeFilter ? 'bg-muted' : ''}`}
            >
              <UserAvatar user={user} className="h-5 w-5" />
              <span className="truncate">{user.name}</span>
            </DropdownMenuItem>
          ))}
          {assigneeOptions.length === 0 && (
            <DropdownMenuItem disabled>No one assigned yet</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function AddTaskInput({ onAddTask }: { onAddTask: (title: string) => void }) {
  const [value, setValue] = useState('')
  const [active, setActive] = useState(false)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onAddTask(trimmed)
    setValue('')
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors py-0.5 mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        add task
      </button>
    )
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit()
        if (e.key === 'Escape') {
          setValue('')
          setActive(false)
        }
      }}
      onBlur={() => {
        handleSubmit()
        setActive(false)
      }}
      placeholder="Task title…"
      className="w-full text-sm bg-transparent border-b border-foreground/10 focus:border-foreground/30 py-1 outline-none placeholder:text-muted-foreground/40 mt-1"
      autoFocus
    />
  )
}
