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

export type AssigneeCluster = {
  faces: OrganizationUser[]
  overflow: number
  hasFormerMember: boolean
}

// The deduped set of people on a scope's tasks, for the Scope Card cluster.
// An identity signal (who's on it), not a completion signal — so it stays
// within ADR 0007. `faces` is capped; `overflow` is how many distinct named
// assignees were dropped past the cap. A dangling id (former member) flips
// `hasFormerMember` but never becomes a face — we have no name for it.
export function deriveAssigneeCluster(
  tasks: { assigneeId?: string }[],
  orgUsers: OrganizationUser[],
  cap: number
): AssigneeCluster {
  const seen = new Set<string>()
  const faces: OrganizationUser[] = []
  let hasFormerMember = false

  for (const task of tasks) {
    const resolved = resolveTaskAssignee(task.assigneeId, orgUsers)
    if (resolved.kind === 'assigned') {
      if (!seen.has(resolved.user.userId)) {
        seen.add(resolved.user.userId)
        faces.push(resolved.user)
      }
    } else if (resolved.kind === 'former_member') {
      hasFormerMember = true
    }
  }

  return {
    faces: faces.slice(0, cap),
    overflow: Math.max(0, faces.length - cap),
    hasFormerMember,
  }
}

// ── Drawer-local task filters ──
// Pure helpers behind the Scope Drawer's All/Open + by-assignee controls. The
// filter state itself is ephemeral per-viewer UI state (never Liveblocks); this
// module only computes what to show given the tasks.

export type TaskFilter = {
  // When true, hide done tasks (show only Open). Open is never called "active".
  openOnly?: boolean
  // When set, keep only tasks assigned to this userId.
  assigneeId?: string
}

export function filterTasks<T extends { done: boolean; assigneeId?: string }>(
  tasks: T[],
  filter: TaskFilter
): T[] {
  return tasks.filter((t) => {
    if (filter.openOnly && t.done) return false
    if (filter.assigneeId && t.assigneeId !== filter.assigneeId) return false
    return true
  })
}

// Controls self-hide when there is no choice to make: the All/Open toggle only
// when at least one task is done, the assignee filter only when more than one
// distinct assignee is present (a single-owner scope needs no filter).
export function filterControlVisibility(
  tasks: { done: boolean; assigneeId?: string }[]
): { showOpenToggle: boolean; showAssigneeFilter: boolean } {
  const distinctAssignees = new Set(
    tasks.map((t) => t.assigneeId).filter((id): id is string => !!id)
  )
  return {
    showOpenToggle: tasks.some((t) => t.done),
    showAssigneeFilter: distinctAssignees.size > 1,
  }
}

// The assignee chips to offer: distinct current org members present on the
// tasks, deduped and in first-seen order. Unassigned and former-member tasks
// contribute no chip — you can't filter by an anonymous ghost.
export function assigneeFilterOptions(
  tasks: { assigneeId?: string }[],
  orgUsers: OrganizationUser[]
): OrganizationUser[] {
  const seen = new Set<string>()
  const options: OrganizationUser[] = []
  for (const task of tasks) {
    const resolved = resolveTaskAssignee(task.assigneeId, orgUsers)
    if (resolved.kind === 'assigned' && !seen.has(resolved.user.userId)) {
      seen.add(resolved.user.userId)
      options.push(resolved.user)
    }
  }
  return options
}
