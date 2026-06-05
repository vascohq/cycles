'use client'

import { forwardRef } from 'react'
import type { Tier } from '@/cycle-liveblocks.config'
import { readableTextColor } from '@/lib/color-engine'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Trash2, GripVertical, Star } from 'lucide-react'
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
  /** Identity color for the order badge and hill dot (see ADR 0008). */
  color: string
  litmus_text: string
  /** True when this scope is the pitch's Core Scope (see ADR 0012). */
  isCore?: boolean
  tasks: ScopeCardTask[]
  /** Open the scope drawer — fired by clicking anywhere on the card body. */
  onOpen?: () => void
  onDelete?: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
  readOnly?: boolean
}

// A scope card is a big-picture tile: the scope's name leads, "what it ships"
// (litmus) supports it, and a non-numeric presence indicator hints that a
// checklist exists — never a completion count (see ADR 0007). Clicking the body
// opens the Scope Drawer where tasks and fields are managed.
export const ScopeCard = forwardRef<HTMLDivElement, ScopeCardProps>(
  function ScopeCard(
    {
      order,
      title,
      tier,
      color,
      litmus_text,
      isCore,
      tasks,
      onOpen,
      onDelete,
      dragHandleProps,
      isDragging,
      readOnly,
    },
    ref
  ) {
    const totalCount = tasks.length
    const clickable = !!onOpen

    return (
      <div
        ref={ref}
        {...(clickable
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: onOpen,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen()
                }
              },
            }
          : {})}
        className={`rounded-lg border bg-card p-4 flex flex-col gap-2 h-44 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ${
          isDragging ? 'shadow-lg opacity-75' : ''
        } ${clickable ? 'cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring' : ''}`}
      >
        <div className="flex items-start gap-3 flex-shrink-0">
          <div
            {...(readOnly ? {} : dragHandleProps)}
            onClick={(e) => e.stopPropagation()}
            title={readOnly ? undefined : 'Drag to reorder'}
            className={`group/badge relative flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ backgroundColor: color, color: readableTextColor(color) }}
          >
            {readOnly ? (
              order
            ) : (
              <>
                <span className="transition-opacity group-hover/badge:opacity-0">
                  {order}
                </span>
                <GripVertical className="w-4 h-4 absolute inset-0 m-auto opacity-0 transition-opacity group-hover/badge:opacity-100" />
              </>
            )}
          </div>
          <h3 className="flex-1 min-w-0 text-base font-semibold leading-snug tracking-tight line-clamp-2">
            {isCore && (
              <Star
                aria-label="Core scope"
                className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5 align-middle fill-amber-400 text-amber-400"
              />
            )}
            {title}
          </h3>
          <Badge variant={tier} className="flex-shrink-0 mt-0.5">
            {tier}
          </Badge>
          {!readOnly && onDelete && (
            <div onClick={(e) => e.stopPropagation()}>
              <ScopeActions onDelete={onDelete} />
            </div>
          )}
        </div>

        {litmus_text && (
          <div className="flex-shrink-0">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
              what it ships
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
              {litmus_text}
            </p>
          </div>
        )}

        <div className="flex-1" />

        {totalCount > 0 && <TaskPresence tasks={tasks} />}
      </div>
    )
  }
)

// Non-numeric presence: one tick per task, filled as tasks complete. Signals
// "there's a checklist here" without asserting a completion percentage. Caps
// the rendered ticks so a long list stays a single tidy row.
function TaskPresence({ tasks }: { tasks: ScopeCardTask[] }) {
  const MAX_TICKS = 12
  const total = tasks.length
  const shown = tasks.slice(0, MAX_TICKS)

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="flex items-center gap-1">
        {shown.map((task) => (
          <span
            key={task.id}
            className={`w-2 h-2 rounded-[3px] ${
              task.done ? 'bg-foreground/50' : 'bg-foreground/15'
            }`}
          />
        ))}
        {total > MAX_TICKS && (
          <span className="text-[10px] text-muted-foreground/50 ml-0.5">
            +{total - MAX_TICKS}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground/70">
        {total} task{total === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function ScopeActions({ onDelete }: { onDelete: () => void }) {
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
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
