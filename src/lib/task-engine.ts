import type { OrganizationUser } from './users'

// The resolved identity behind a task's `assigneeId`. A task points at a Clerk
// org user by id; this turns that nullable pointer into one of three states the
// UI renders directly — never a fabricated "Unknown user". A dangling id (the
// person left the org, or the cycle was reopened past their membership) is a
// Former member, distinct from a task nobody ever claimed (Unassigned).
export type TaskAssignee =
  | { kind: 'unassigned' }
  | { kind: 'assigned'; user: OrganizationUser }
  | { kind: 'former_member' }

export function resolveTaskAssignee(
  assigneeId: string | undefined,
  orgUsers: OrganizationUser[]
): TaskAssignee {
  if (!assigneeId) return { kind: 'unassigned' }
  const user = orgUsers.find((u) => u.userId === assigneeId)
  if (user) return { kind: 'assigned', user }
  return { kind: 'former_member' }
}
