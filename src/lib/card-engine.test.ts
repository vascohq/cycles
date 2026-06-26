import { describe, it, expect } from 'vitest'
import {
  cardStatus,
  groupCardsByStatus,
  becameDone,
  areAllCardsDone,
} from './card-engine'

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

describe('becameDone', () => {
  it('is true only when a card crosses into done', () => {
    expect(becameDone('todo', 'done')).toBe(true)
    expect(becameDone('doing', 'done')).toBe(true)
  })

  it('is false when it was already done or moved elsewhere', () => {
    expect(becameDone('done', 'done')).toBe(false)
    expect(becameDone('todo', 'doing')).toBe(false)
    expect(becameDone('done', 'todo')).toBe(false)
  })
})

describe('areAllCardsDone', () => {
  it('is true only when there is at least one card and all are done', () => {
    expect(areAllCardsDone([{ status: 'done' }, { done: true }])).toBe(true)
  })

  it('is false when any card is not done', () => {
    expect(areAllCardsDone([{ status: 'done' }, { status: 'doing' }])).toBe(false)
  })

  it('is false for an empty board', () => {
    expect(areAllCardsDone([])).toBe(false)
  })
})
