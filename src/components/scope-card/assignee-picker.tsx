'use client'

import { UserMinus, UserPlus } from 'lucide-react'
import type { OrganizationUser } from '@/lib/users'
import { resolveTaskAssignee } from '@/lib/task-engine'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

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
// slot / former-member ghost) and opens a menu of the cycle's org members.
// Built on Radix DropdownMenu so it portals correctly AND stays interactive
// inside the Scope Drawer's Sheet (a hand-rolled body portal gets
// pointer-events:none from the Dialog, which made clicks fall through to the
// task row — the "marks done while assigning" bug). DropdownMenu's native
// typeahead lets you jump to a member by typing.
export function AssigneePicker({
  orgUsers,
  assigneeId,
  onAssign,
  onClear,
  readOnly,
}: AssigneePickerProps) {
  const resolved = resolveTaskAssignee(assigneeId, orgUsers)

  const trigger = (() => {
    if (resolved.kind === 'assigned') return <UserAvatar user={resolved.user} />
    if (resolved.kind === 'former_member') {
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

  if (readOnly) {
    // No affordance to change — just render the avatar/ghost.
    return <span className="flex-shrink-0">{trigger}</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          resolved.kind === 'assigned'
            ? `Assigned to ${resolved.user.name}`
            : 'Assign task'
        }
        className="flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {orgUsers.map((u) => (
          <DropdownMenuItem
            key={u.userId}
            onSelect={() => onAssign(u.userId)}
            className={u.userId === assigneeId ? 'bg-muted' : ''}
          >
            <UserAvatar user={u} className="h-5 w-5" />
            <span className="truncate">{u.name}</span>
          </DropdownMenuItem>
        ))}
        {orgUsers.length === 0 && (
          <DropdownMenuItem disabled>No members</DropdownMenuItem>
        )}
        {resolved.kind !== 'unassigned' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onClear()} className="text-muted-foreground">
              Unassign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
