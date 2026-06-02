'use client'

import { useState } from 'react'
import type { Tier } from '@/cycle-liveblocks.config'
import { readableTextColor, SCOPE_PALETTE } from '@/lib/color-engine'
import { Check, Plus, Pencil, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { ScopeCardTask } from './scope-card'

const TIERS: Tier[] = ['must', 'should', 'could']

export type ScopeDrawerScope = {
  id: string
  order: number
  title: string
  tier: Tier
  color: string
  litmus_text: string
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
  onTaskToggle?: (taskId: string, done: boolean) => void
  onTaskEdit?: (taskId: string, title: string) => void
  onTaskDelete?: (taskId: string) => void
  onAddTask?: (title: string) => void
  onReset?: () => void
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
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onReset,
  readOnly,
}: ScopeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto">
        {scope && (
          <ScopeDrawerBody
            scope={scope}
            usedColors={usedColors}
            onEditScope={onEditScope}
            onTaskToggle={onTaskToggle}
            onTaskEdit={onTaskEdit}
            onTaskDelete={onTaskDelete}
            onAddTask={onAddTask}
            onReset={onReset}
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
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onReset,
  readOnly,
}: Omit<ScopeDrawerProps, 'open' | 'onOpenChange' | 'scope'> & {
  scope: ScopeDrawerScope
}) {
  const doneCount = scope.tasks.filter((t) => t.done).length

  return (
    <>
      <SheetHeader className="pr-8">
        <div className="flex items-center gap-2">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: scope.color, color: readableTextColor(scope.color) }}
          >
            {scope.order}
          </span>
          <SheetTitle className="sr-only">Scope</SheetTitle>
          <SheetDescription className="sr-only">
            Edit the scope name, tier, color, what it ships, and its tasks.
          </SheetDescription>
          <TierControl
            tier={scope.tier}
            readOnly={readOnly}
            onChange={(tier) => onEditScope?.({ tier })}
          />
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

      {/* Color */}
      {!readOnly && onEditScope && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1.5">
            color
          </p>
          <ColorPicker
            value={scope.color}
            usedColors={usedColors}
            onPick={(color) => onEditScope({ color })}
          />
        </div>
      )}

      {/* What it ships (litmus) — the fuller framing lives here, where there's room */}
      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">
          what it ships
        </p>
        <p className="text-xs text-muted-foreground/60 mb-1.5 leading-snug">
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
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
            tasks
          </p>
          {doneCount > 0 && onReset && !readOnly && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              reset
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {scope.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              readOnly={readOnly}
              onToggle={
                onTaskToggle ? () => onTaskToggle(task.id, !task.done) : undefined
              }
              onEdit={onTaskEdit ? (title) => onTaskEdit(task.id, title) : undefined}
              onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
            />
          ))}

          {scope.tasks.length === 0 && (
            <p className="text-xs text-muted-foreground/50 py-1">No tasks yet.</p>
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

// Palette swatches. Colors used by sibling scopes are flagged with a small ring
// + dot but stay selectable — uniqueness is guaranteed on auto-assign, manual
// override is allowed (see ADR 0008). A generated (non-palette) current color is
// shown first so it's selectable too.
function ColorPicker({
  value,
  usedColors,
  onPick,
}: {
  value: string
  usedColors: string[]
  onPick: (color: string) => void
}) {
  const swatches = SCOPE_PALETTE.includes(value)
    ? SCOPE_PALETTE
    : [value, ...SCOPE_PALETTE]

  return (
    <div className="flex flex-wrap gap-1.5">
      {swatches.map((color) => {
        const selected = color === value
        const inUse = !selected && usedColors.includes(color)
        return (
          <button
            key={color}
            type="button"
            aria-label={inUse ? `${color} (in use)` : color}
            aria-pressed={selected}
            onClick={() => onPick(color)}
            className={`relative w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            {selected && (
              <Check
                className="w-3.5 h-3.5 absolute inset-0 m-auto"
                style={{ color: readableTextColor(color) }}
              />
            )}
            {inUse && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground ring-1 ring-background" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// A single task line: checkbox + title toggle done; hover reveals inline rename
// (pencil) and delete (X). Enter/blur saves a rename, Esc cancels, empty reverts.
function TaskRow({
  task,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: ScopeCardTask
  readOnly?: boolean
  onToggle?: () => void
  onEdit?: (title: string) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.title)

  function startEdit() {
    setValue(task.title)
    setEditing(true)
  }

  function save() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== task.title) onEdit?.(trimmed)
    setEditing(false)
  }

  if (editing && onEdit) {
    return (
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setValue(task.title)
            setEditing(false)
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={save}
        className="w-full text-sm bg-transparent border-b border-foreground/30 py-0.5 outline-none"
        autoFocus
      />
    )
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm py-0.5 ${readOnly ? '' : 'group'}`}
    >
      <button
        type="button"
        {...(!readOnly && onToggle ? { onClick: onToggle } : { disabled: true })}
        className="flex items-center gap-2 text-left min-w-0 flex-1"
      >
        <span
          className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            task.done
              ? 'bg-foreground/10 border-foreground/20'
              : readOnly
                ? 'border-foreground/20'
                : 'border-foreground/20 group-hover:border-foreground/40'
          }`}
        >
          {task.done && <Check className="w-3 h-3 text-foreground/60" />}
        </span>
        <span
          className={`truncate ${
            task.done ? 'line-through text-muted-foreground/60' : 'text-foreground'
          }`}
        >
          {task.title}
        </span>
      </button>

      {!readOnly && (onEdit || onDelete) && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onEdit && (
            <button
              type="button"
              aria-label="Edit task"
              onClick={startEdit}
              className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete task"
              onClick={onDelete}
              className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
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
