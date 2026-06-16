import { describe, it, expect } from 'vitest'
import { resolveTaskAssignee } from './task-engine'
import type { OrganizationUser } from './users'

const simon: OrganizationUser = {
  userId: 'u_simon',
  name: 'Simon',
  initials: 'S',
  hasImage: false,
  imageUrl: '',
}
const USERS: OrganizationUser[] = [simon]

describe('resolveTaskAssignee', () => {
  it('is unassigned when there is no assigneeId', () => {
    expect(resolveTaskAssignee(undefined, USERS)).toEqual({ kind: 'unassigned' })
  })

  it('treats an empty-string assigneeId as unassigned', () => {
    expect(resolveTaskAssignee('', USERS)).toEqual({ kind: 'unassigned' })
  })

  it('is assigned to the matching org user', () => {
    expect(resolveTaskAssignee('u_simon', USERS)).toEqual({
      kind: 'assigned',
      user: simon,
    })
  })

  it('is a former member when the assigneeId matches no current org user', () => {
    expect(resolveTaskAssignee('u_gone', USERS)).toEqual({ kind: 'former_member' })
  })
})
