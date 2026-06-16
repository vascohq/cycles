import { describe, it, expect } from 'vitest'
import {
  resolveTaskAssignee,
  deriveAssigneeCluster,
  filterTasks,
  filterControlVisibility,
  assigneeFilterOptions,
} from './task-engine'
import type { OrganizationUser } from './users'

function user(id: string, name: string): OrganizationUser {
  return { userId: id, name, initials: name[0], hasImage: false, imageUrl: '' }
}

const simon = user('u_simon', 'Simon')
const marie = user('u_marie', 'Marie')
const emile = user('u_emile', 'Emile')
const seb = user('u_seb', 'Seb')
const USERS: OrganizationUser[] = [simon]
const ALL_USERS: OrganizationUser[] = [simon, marie, emile, seb]

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

describe('deriveAssigneeCluster', () => {
  it('dedups a person who appears on several tasks into one face', () => {
    const tasks = [{ assigneeId: 'u_simon' }, { assigneeId: 'u_simon' }]
    expect(deriveAssigneeCluster(tasks, ALL_USERS, 3)).toEqual({
      faces: [simon],
      overflow: 0,
      hasFormerMember: false,
    })
  })

  it('caps the faces and reports the overflow count', () => {
    const tasks = [
      { assigneeId: 'u_simon' },
      { assigneeId: 'u_marie' },
      { assigneeId: 'u_emile' },
      { assigneeId: 'u_seb' },
    ]
    const cluster = deriveAssigneeCluster(tasks, ALL_USERS, 3)
    expect(cluster.faces).toHaveLength(3)
    expect(cluster.overflow).toBe(1)
  })

  it('flags a former member without adding a face for the dangling id', () => {
    const tasks = [{ assigneeId: 'u_simon' }, { assigneeId: 'u_gone' }]
    const cluster = deriveAssigneeCluster(tasks, ALL_USERS, 3)
    expect(cluster.faces).toEqual([simon])
    expect(cluster.hasFormerMember).toBe(true)
  })

  it('is empty when no task is assigned', () => {
    const tasks = [{ assigneeId: undefined }, {}]
    expect(deriveAssigneeCluster(tasks, ALL_USERS, 3)).toEqual({
      faces: [],
      overflow: 0,
      hasFormerMember: false,
    })
  })
})

const FILTER_TASKS = [
  { id: 'a', done: false, assigneeId: 'u_simon' },
  { id: 'b', done: true, assigneeId: 'u_simon' },
  { id: 'c', done: false, assigneeId: 'u_marie' },
  { id: 'd', done: false, assigneeId: undefined },
]

describe('filterTasks', () => {
  it('returns every task when no filter is set', () => {
    expect(filterTasks(FILTER_TASKS, {})).toEqual(FILTER_TASKS)
  })

  it('hides done tasks when openOnly is set', () => {
    expect(filterTasks(FILTER_TASKS, { openOnly: true }).map((t) => t.id)).toEqual([
      'a',
      'c',
      'd',
    ])
  })

  it('narrows to a single assignee', () => {
    expect(
      filterTasks(FILTER_TASKS, { assigneeId: 'u_simon' }).map((t) => t.id)
    ).toEqual(['a', 'b'])
  })

  it('composes openOnly and assignee with AND', () => {
    expect(
      filterTasks(FILTER_TASKS, { openOnly: true, assigneeId: 'u_simon' }).map(
        (t) => t.id
      )
    ).toEqual(['a'])
  })
})

describe('filterControlVisibility', () => {
  it('shows the open toggle only when at least one task is done', () => {
    expect(filterControlVisibility(FILTER_TASKS).showOpenToggle).toBe(true)
    expect(
      filterControlVisibility([{ done: false, assigneeId: 'u_simon' }]).showOpenToggle
    ).toBe(false)
  })

  it('shows the assignee filter only when more than one distinct assignee is present', () => {
    expect(filterControlVisibility(FILTER_TASKS).showAssigneeFilter).toBe(true)
    expect(
      filterControlVisibility([
        { done: false, assigneeId: 'u_simon' },
        { done: true, assigneeId: 'u_simon' },
      ]).showAssigneeFilter
    ).toBe(false)
  })
})

describe('assigneeFilterOptions', () => {
  it('lists the distinct current-member assignees present, deduped', () => {
    expect(assigneeFilterOptions(FILTER_TASKS, ALL_USERS)).toEqual([simon, marie])
  })

  it('omits unassigned and former-member tasks', () => {
    const tasks = [
      { done: false, assigneeId: 'u_gone' },
      { done: false, assigneeId: undefined },
    ]
    expect(assigneeFilterOptions(tasks, ALL_USERS)).toEqual([])
  })
})
