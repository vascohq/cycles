'use client'

import { forwardRef, useState } from 'react'
import type { Tier } from '@/cycle-liveblocks.config'
import { TIER_COLORS } from '@/components/hill-chart/tier-colors'
import { Check, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ScopeCardTask = {
  id: string
  title: string
  done: boolean
}

export type ScopeCardProps = {
  id: string
  order: number
  title: string
  tier: Tier
  litmus_text: string
  tasks: ScopeCardTask[]
  onTaskToggle?: (taskId: string, done: boolean) => void
  onAddTask?: (title: string) => void
  onReset?: () => void
  onEdit?: () => void
  onDelete?: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
  readOnly?: boolean
}

export const ScopeCard = forwardRef<HTMLDivElement, ScopeCardProps>(
  function ScopeCard(
    {
      order,
      title,
      tier,
      litmus_text,
      tasks,
      onTaskToggle,
      onAddTask,
      onReset,
      onEdit,
      onDelete,
      dragHandleProps,
      isDragging,
      readOnly,
    },
    ref
  ) {
    const doneCount = tasks.filter((t) => t.done).length
    const totalCount = tasks.length

    return (
      <div
        ref={ref}
        className={`rounded-lg border bg-card p-4 flex flex-col gap-3 h-64 transition-shadow ${
          isDragging ? 'shadow-lg opacity-75' : ''
        }`}
      >
        <div className="flex items-start gap-3 flex-shrink-0">
          <div
            {...(readOnly ? {} : dragHandleProps)}
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ backgroundColor: TIER_COLORS[tier] }}
          >
            {order}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight tracking-tight truncate">
              {title}
            </h3>
            {litmus_text && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                <span className="font-mono text-[10px] opacity-50 mr-1">
                  if only this ships:
                </span>
                {litmus_text}
              </p>
            )}
          </div>
          {!readOnly && (onEdit || onDelete) && (
            <ScopeActions onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>

        {/* Tasks scroll within the fixed-height card so it never grows; a
            bottom fade hints at more when the list overflows. */}
        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto flex flex-col gap-1 pr-1">
            {tasks.map((task) => {
              const Tag = readOnly ? 'div' : 'button'
              return (
                <Tag
                  key={task.id}
                  {...(!readOnly && { type: 'button' as const, onClick: () => onTaskToggle?.(task.id, !task.done) })}
                  className={`flex items-center gap-2 text-xs text-left py-0.5 flex-shrink-0 ${readOnly ? '' : 'group'}`}
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
                    {task.done && (
                      <Check className="w-3 h-3 text-foreground/60" />
                    )}
                  </span>
                  <span
                    className={
                      task.done
                        ? 'line-through text-muted-foreground/60'
                        : 'text-foreground'
                    }
                  >
                    {task.title}
                  </span>
                </Tag>
              )
            })}

            {onAddTask && !readOnly && (
              <AddTaskInput onAddTask={onAddTask} />
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card to-transparent" />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <span>
            {doneCount}/{totalCount} done
          </span>
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
      </div>
    )
  }
)

function ScopeActions({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Scope actions"
          className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
        className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-0.5"
      >
        <Plus className="w-3 h-3" />
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
        if (e.key === 'Escape') { setValue(''); setActive(false) }
      }}
      onBlur={() => { handleSubmit(); setActive(false) }}
      placeholder="Task title…"
      className="w-full text-xs bg-transparent border-b border-foreground/10 focus:border-foreground/30 py-1 outline-none placeholder:text-muted-foreground/40"
      autoFocus
    />
  )
}
