import { describe, it, expect } from 'vitest'
import {
  cardStatus,
  groupCardsByStatus,
  becameDone,
  areAllCardsDone,
  deriveBoardCards,
  moveTargetIndex,
  resolveCardDrop,
} from './card-engine'
import type { ScopeTask } from '@/cycle-liveblocks.config'

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

describe('deriveBoardCards', () => {
  const scopes = [
    { id: 's1', title: 'Scope one', color: '#111111' },
    { id: 's2', title: 'Scope two', color: '#222222' },
  ]
  const tasks: ScopeTask[] = [
    { id: 't1', scopeId: 's2', title: 'Second scope, first card', done: false },
    { id: 't2', pitchId: 'p1', title: 'Unscoped', done: false },
    { id: 't3', scopeId: 's1', title: 'First scope', done: false },
    { id: 't4', scopeId: 'other-pitch-scope', title: 'Elsewhere', done: false },
    { id: 't5', pitchId: 'p2', title: 'Another pitch triage', done: false },
  ]

  it('keeps the tasks-list order rather than grouping by scope', () => {
    expect(deriveBoardCards(tasks, scopes, 'p1').map((c) => c.id)).toEqual(['t1', 't2', 't3'])
  })

  it('resolves the scope tag, leaving unscoped cards untagged', () => {
    const cards = deriveBoardCards(tasks, scopes, 'p1')
    expect(cards[0]).toMatchObject({ scopeId: 's2', scopeTitle: 'Scope two', scopeColor: '#222222' })
    expect(cards[1].scopeId).toBeUndefined()
    expect(cards[1].scopeTitle).toBeUndefined()
  })

  it('excludes cards from other pitches', () => {
    const ids = deriveBoardCards(tasks, scopes, 'p1').map((c) => c.id)
    expect(ids).not.toContain('t4')
    expect(ids).not.toContain('t5')
  })
})

describe('moveTargetIndex', () => {
  // Mirrors LiveList.move: the element is removed first, so indices below it
  // shift up by one.
  const move = (list: string[], from: number, to: number) => {
    const copy = [...list]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  }
  const list = ['a', 'b', 'c', 'd']

  it('lands a card immediately after its anchor, moving down or up', () => {
    expect(move(list, 0, moveTargetIndex(0, 2, 'after'))).toEqual(['b', 'c', 'a', 'd'])
    expect(move(list, 3, moveTargetIndex(3, 1, 'after'))).toEqual(['a', 'b', 'd', 'c'])
  })

  it('lands a card immediately before its anchor, moving down or up', () => {
    expect(move(list, 0, moveTargetIndex(0, 2, 'before'))).toEqual(['b', 'a', 'c', 'd'])
    expect(move(list, 3, moveTargetIndex(3, 1, 'before'))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when the card is already next to its anchor', () => {
    expect(moveTargetIndex(1, 0, 'after')).toBe(1)
    expect(moveTargetIndex(1, 2, 'before')).toBe(1)
  })
})

describe('resolveCardDrop', () => {
  const columns = {
    todo: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    doing: [{ id: 'd' }],
    done: [] as { id: string }[],
  }

  it('reorders within a column, anchoring after the card when dragged down', () => {
    expect(resolveCardDrop('a', 'c', columns)).toEqual({
      status: 'todo',
      anchor: { id: 'c', placement: 'after' },
    })
  })

  it('reorders within a column, anchoring before the card when dragged up', () => {
    expect(resolveCardDrop('c', 'a', columns)).toEqual({
      status: 'todo',
      anchor: { id: 'a', placement: 'before' },
    })
  })

  it('takes the hovered card place when it comes from another column', () => {
    expect(resolveCardDrop('d', 'b', columns)).toEqual({
      status: 'todo',
      anchor: { id: 'b', placement: 'before' },
    })
  })

  it('lands at the bottom — lowest priority — when dropped on a column', () => {
    expect(resolveCardDrop('d', 'todo', columns)).toEqual({
      status: 'todo',
      anchor: { id: 'c', placement: 'after' },
    })
  })

  it('anchors on the last *other* card when dropped on its own column', () => {
    expect(resolveCardDrop('a', 'todo', columns)).toEqual({
      status: 'todo',
      anchor: { id: 'c', placement: 'after' },
    })
  })

  it('changes column with no anchor when the target column is empty', () => {
    expect(resolveCardDrop('a', 'done', columns)).toEqual({ status: 'done', anchor: null })
  })

  it('is a no-op on the card itself, or on an unknown target', () => {
    expect(resolveCardDrop('a', 'a', columns)).toBeNull()
    expect(resolveCardDrop('a', 'ghost', columns)).toBeNull()
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
