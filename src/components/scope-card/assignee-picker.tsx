'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserMinus, UserPlus } from 'lucide-react'
import type { OrganizationUser } from '@/lib/users'
import { resolveTaskAssignee } from '@/lib/task-engine'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// A small round avatar for one org user — photo when available, initials fallback.
export function UserAvatar({
  user,
  className = 'h-5 w-5',
}: {
  user: OrganizationUser
  className?: string
}) {
  return (
    <Avatar className={className}>
      {user.hasImage && <AvatarImage src={user.imageUrl} alt={user.name} />}
      <AvatarFallback className="text-[9px] font-medium text-muted-foreground">
        {user.initials}
      </AvatarFallback>
    </Avatar>
  )
}

type AssigneePickerProps = {
  orgUsers: OrganizationUser[]
  assigneeId?: string
  onAssign: (userId: string) => void
  onClear: () => void
  readOnly?: boolean
}

// Per-task assignee control: shows the assignee as an avatar (or an unassigned
// slot / former-member ghost) and opens a type-ahead panel of the cycle's org
// members. Mirrors the SquadPicker's portaled-popover pattern. Keyboard-fluent
// within the panel; full row-level keyboard nav is deferred (see CONTEXT.md).
export function AssigneePicker({
  orgUsers,
  assigneeId,
  onAssign,
  onClear,
  readOnly,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  const resolved = resolveTaskAssignee(assigneeId, orgUsers)

  function toggleOpen() {
    if (readOnly) return
    if (!open) {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? orgUsers.filter((u) => u.name.toLowerCase().includes(trimmed))
    : orgUsers

  function assign(userId: string) {
    onAssign(userId)
    setQuery('')
    setOpen(false)
  }

  const trigger = (() => {
    if (resolved.kind === 'assigned') {
      return <UserAvatar user={resolved.user} />
    }
    if (resolved.kind === 'former_member') {
      // Anonymous greyed ghost — the assignee left the org; click to re-home.
      return (
        <span
          title="Assignee no longer in this org — click to reassign"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60"
        >
          <UserMinus className="h-3 w-3" />
        </span>
      )
    }
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-foreground/25 text-muted-foreground/50">
        <UserPlus className="h-3 w-3" />
      </span>
    )
  })()

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={readOnly}
        aria-label={resolved.kind === 'assigned' ? `Assigned to ${resolved.user.name}` : 'Assign task'}
        className={readOnly ? 'cursor-default' : 'cursor-pointer'}
      >
        {trigger}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className="z-50 w-60 rounded-md border bg-popover p-1 shadow-md"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Assign to…"
            className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1 max-h-64 overflow-y-auto">
            {filtered.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => assign(u.userId)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  u.userId === assigneeId ? 'bg-muted' : ''
                }`}
              >
                <UserAvatar user={u} />
                <span className="truncate">{u.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground/60">No members found.</p>
            )}
            {resolved.kind !== 'unassigned' && (
              <button
                type="button"
                onClick={() => {
                  onClear()
                  setQuery('')
                  setOpen(false)
                }}
                className="mt-1 flex w-full items-center rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Unassign
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
