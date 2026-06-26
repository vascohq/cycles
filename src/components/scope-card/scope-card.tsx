'use client'

import { forwardRef } from 'react'
import type { Tier, CardStatus } from '@/cycle-liveblocks.config'
import type { OrganizationUser } from '@/lib/users'
import { deriveAssigneeCluster } from '@/lib/task-engine'
import { UserAvatar } from './assignee-picker'
import { readableTextColor } from '@/lib/color-engine'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Trash2, GripVertical, Star, Check, UserMinus } from 'lucide-react'
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
  /** Kanban column (see ADR 0018); absent on legacy tasks — derive with cardStatus. */
  status?: CardStatus
  /** Clerk userId of the assignee, or undefined when Unassigned (see ADR 0017). */
  assigneeId?: string
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
  /** Cycle org members, to resolve the assignee cluster. Empty = no cluster. */
  orgUsers?: OrganizationUser[]
  /** Hill progress has reached the foot (1) — card is muted and marked done. */
  done?: boolean
  /** Open the scope drawer — fired by clicking anywhere on the card body. */
  onOpen?: () => void
  /**
   * Flag or unflag this scope as the pitch's Core Scope from the card. When
   * provided (and not readOnly) the leading star becomes a one-click affordance:
   * outline + hover-revealed when not core, filled + always-visible when core.
   * Setting core silently steals it from any other scope (the setter handles it).
   */
  onToggleCore?: (next: boolean) => void
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
      orgUsers = [],
      done,
      onOpen,
      onToggleCore,
      onDelete,
      dragHandleProps,
      isDragging,
      readOnly,
    },
    ref
  ) {
    const totalCount = tasks.length
    const clickable = !!onOpen
    // Deduped people across this scope's tasks — an identity signal (who's on
    // it), never a completion claim, so it stays within ADR 0007.
    const cluster = deriveAssigneeCluster(tasks, orgUsers, 3)
    const hasCluster =
      cluster.faces.length > 0 || cluster.overflow > 0 || cluster.hasFormerMember

    // A done scope recedes via a grayed background (clearer than dimming the
    // whole card) while staying readable; in-progress cards keep the bright
    // card surface so the contrast between "done" and "still going" is obvious.
    const cardClassName = [
      'rounded-lg border p-4 flex flex-col gap-2 h-44 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200',
      done ? 'bg-muted/40' : 'bg-card',
      isDragging ? 'shadow-lg opacity-75' : '',
      clickable
        ? `cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border ${
            done ? 'hover:bg-muted/60' : 'hover:bg-muted/30'
          } focus:outline-none focus:ring-2 focus:ring-ring`
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    // Done scopes show a checkmark in the identity badge instead of the order
    // number — the badge keeps the scope's color so it's still recognizable.
    const badgeFace = done ? (
      <Check role="img" aria-label="Done" className="w-4 h-4" />
    ) : (
      order
    )

    return (
      <div
        ref={ref}
        data-done={done ? 'true' : undefined}
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
        className={cardClassName}
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
              badgeFace
            ) : (
              <>
                <span className="transition-opacity group-hover/badge:opacity-0">
                  {badgeFace}
                </span>
                <GripVertical className="w-4 h-4 absolute inset-0 m-auto opacity-0 transition-opacity group-hover/badge:opacity-100" />
              </>
            )}
          </div>
          <h3
            className={`flex-1 min-w-0 text-base font-semibold leading-snug tracking-tight line-clamp-2 ${
              done ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {isCore && (
              // Marks the heart of the pitch. The star only renders on the core
              // scope, so non-core cards keep a clean, full-width title. Flagging
              // a core lives in the "…" actions menu (see ADR 0012).
              <Star
                aria-label="Core scope"
                className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5 align-middle fill-amber-400 text-amber-400"
              />
            )}
            {title}
          </h3>
          <Badge
            variant={tier}
            className={`flex-shrink-0 mt-0.5 ${done ? 'opacity-50' : ''}`}
          >
            {tier}
          </Badge>
          {!readOnly && (onDelete || onToggleCore) && (
            <div onClick={(e) => e.stopPropagation()}>
              <ScopeActions
                isCore={isCore}
                onToggleCore={onToggleCore}
                onDelete={onDelete}
              />
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

        {(totalCount > 0 || hasCluster) && (
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            {totalCount > 0 ? <TaskPresence tasks={tasks} /> : <span />}
            {hasCluster && (
              <AssigneeCluster
                faces={cluster.faces}
                overflow={cluster.overflow}
                hasFormerMember={cluster.hasFormerMember}
              />
            )}
          </div>
        )}
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

// Deduped avatar cluster — who's on this scope. Overlapping faces, a "+N"
// overflow chip past the cap, and a greyed person-minus when a former member
// holds a task. Identity, not completion (see ADR 0007).
function AssigneeCluster({
  faces,
  overflow,
  hasFormerMember,
}: {
  faces: OrganizationUser[]
  overflow: number
  hasFormerMember: boolean
}) {
  return (
    <div className="flex items-center -space-x-1.5">
      {faces.map((user) => (
        <span key={user.userId} className="ring-2 ring-card rounded-full">
          <UserAvatar user={user} className="h-5 w-5" />
        </span>
      ))}
      {hasFormerMember && (
        <span
          title="A former member holds a task here"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60 ring-2 ring-card"
        >
          <UserMinus className="h-3 w-3" />
        </span>
      )}
      {overflow > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground ring-2 ring-card">
          +{overflow}
        </span>
      )}
    </div>
  )
}

function ScopeActions({
  isCore,
  onToggleCore,
  onDelete,
}: {
  isCore?: boolean
  onToggleCore?: (next: boolean) => void
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
      <DropdownMenuContent align="end" className="w-44">
        {onToggleCore && (
          <DropdownMenuItem onClick={() => onToggleCore(!isCore)}>
            <Star
              className={`w-3.5 h-3.5 mr-2 ${isCore ? 'fill-amber-400 text-amber-400' : ''}`}
            />
            {isCore ? 'Unflag core scope' : 'Set as core scope'}
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
