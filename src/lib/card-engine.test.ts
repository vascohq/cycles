import { describe, it, expect } from 'vitest'
import { cardStatus, groupCardsByStatus } from './card-engine'

describe('cardStatus', () => {
  it('returns the explicit status when present', () => {
    expect(cardStatus({ status: 'doing' })).toBe('doing')
  })

  it('falls back from the legacy done flag when status is absent', () => {
    expect(cardStatus({ done: true })).toBe('done')
    expect(cardStatus({ done: false })).toBe('todo')
    expect(cardStatus({})).toBe('todo')
  })
})

describe('groupCardsByStatus', () => {
  it('buckets cards into the three columns, preserving input order', () => {
    const cards = [
      { id: 'a', status: 'doing' as const },
      { id: 'b', status: 'todo' as const },
      { id: 'c', status: 'done' as const },
      { id: 'd', status: 'todo' as const },
    ]
    const columns = groupCardsByStatus(cards)
    expect(columns.todo.map((c) => c.id)).toEqual(['b', 'd'])
    expect(columns.doing.map((c) => c.id)).toEqual(['a'])
    expect(columns.done.map((c) => c.id)).toEqual(['c'])
  })

  it('places legacy status-less tasks via their done flag', () => {
    const cards = [
      { id: 'old-done', done: true },
      { id: 'old-open', done: false },
    ]
    const columns = groupCardsByStatus(cards)
    expect(columns.done.map((c) => c.id)).toEqual(['old-done'])
    expect(columns.todo.map((c) => c.id)).toEqual(['old-open'])
    expect(columns.doing).toEqual([])
  })
})
