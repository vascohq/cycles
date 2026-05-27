import { describe, it, expect } from 'vitest'
import { reorderScopes, taskCounts } from './scope-engine'

describe('reorderScopes', () => {
  const scopes = [
    { id: 'a', order: 1 },
    { id: 'b', order: 2 },
    { id: 'c', order: 3 },
    { id: 'd', order: 4 },
  ]

  it('moving an item forward renumbers all affected scopes', () => {
    const result = reorderScopes(scopes, 'a', 'c')
    expect(result.map((s) => s.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(result.map((s) => s.order)).toEqual([1, 2, 3, 4])
  })

  it('moving an item backward renumbers all affected scopes', () => {
    const result = reorderScopes(scopes, 'd', 'b')
    expect(result.map((s) => s.id)).toEqual(['a', 'd', 'b', 'c'])
    expect(result.map((s) => s.order)).toEqual([1, 2, 3, 4])
  })

  it('returns original scopes when activeId not found', () => {
    const result = reorderScopes(scopes, 'x', 'b')
    expect(result).toBe(scopes)
  })
})

describe('taskCounts', () => {
  const tasks = [
    { scopeId: 's1', done: true },
    { scopeId: 's1', done: false },
    { scopeId: 's1', done: true },
    { scopeId: 's2', done: false },
  ]

  it('counts done and total for a specific scope', () => {
    expect(taskCounts(tasks, 's1')).toEqual({ done: 2, total: 3 })
  })

  it('returns 0/0 for a scope with no tasks', () => {
    expect(taskCounts(tasks, 'none')).toEqual({ done: 0, total: 0 })
  })
})
