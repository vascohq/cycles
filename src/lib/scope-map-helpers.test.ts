import { describe, it, expect } from 'vitest'
import {
  deriveScopeGridItems,
  deriveHillScopes,
  deriveParkingLotItems,
  deriveTotalTaskProgress,
} from './scope-map-helpers'
import type { CycleScope, ScopeTask, ParkingItem } from '@/cycle-liveblocks.config'

const scope1: CycleScope = {
  id: 's1',
  pitchId: 'p1',
  title: 'Auth flow',
  tier: 'must',
  litmus_text: 'Users can sign in',
  hill_progress: 0.3,
  color: '#E54D2E',
}

const scope2: CycleScope = {
  id: 's2',
  pitchId: 'p1',
  title: 'Dashboard',
  tier: 'should',
  litmus_text: 'Users see their data',
  hill_progress: 0.7,
}

const scopeOtherPitch: CycleScope = {
  id: 's3',
  pitchId: 'p2',
  title: 'Other pitch scope',
  tier: 'could',
  litmus_text: 'Not relevant',
  hill_progress: 0.1,
}

const tasks: ScopeTask[] = [
  { id: 't1', scopeId: 's1', title: 'Create login form', done: true },
  { id: 't2', scopeId: 's1', title: 'Add OAuth', done: false },
  { id: 't3', scopeId: 's2', title: 'Build chart widget', done: true },
  { id: 't4', scopeId: 's2', title: 'Add filters', done: true },
  { id: 't5', scopeId: 's3', title: 'Other task', done: false },
]

const parkingItems: ParkingItem[] = [
  { id: 'pk1', pitchId: 'p1', text: 'Which OAuth provider?', resolved: false },
  { id: 'pk2', pitchId: 'p1', text: 'Design review needed?', resolved: true },
  { id: 'pk3', pitchId: 'p2', text: 'Unrelated item', resolved: false },
]

describe('deriveScopeGridItems', () => {
  it('filters scopes to pitch and adds tasks + order', () => {
    const items = deriveScopeGridItems([scope1, scope2, scopeOtherPitch], tasks, 'p1')
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe('s1')
    expect(items[0].order).toBe(1)
    expect(items[0].tasks).toEqual([
      { id: 't1', title: 'Create login form', done: true },
      { id: 't2', title: 'Add OAuth', done: false },
    ])
    expect(items[1].id).toBe('s2')
    expect(items[1].order).toBe(2)
    expect(items[1].tasks).toHaveLength(2)
  })

  it('returns empty array when no scopes for pitch', () => {
    const items = deriveScopeGridItems([scopeOtherPitch], tasks, 'p1')
    expect(items).toEqual([])
  })
})

describe('deriveHillScopes', () => {
  it('maps scopes to HillScope format with order', () => {
    const hillScopes = deriveHillScopes([scope1, scope2, scopeOtherPitch], 'p1')
    expect(hillScopes).toHaveLength(2)
    expect(hillScopes[0]).toEqual({
      id: 's1',
      title: 'Auth flow',
      tier: 'must',
      hill_progress: 0.3,
      order: 1,
    })
    expect(hillScopes[1].order).toBe(2)
  })
})

describe('deriveParkingLotItems', () => {
  it('filters items to the pitch', () => {
    const items = deriveParkingLotItems(parkingItems, 'p1')
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('Which OAuth provider?')
    expect(items[1].resolved).toBe(true)
  })
})

describe('deriveTotalTaskProgress', () => {
  it('counts done and total tasks for a pitch', () => {
    const progress = deriveTotalTaskProgress([scope1, scope2, scopeOtherPitch], tasks, 'p1')
    expect(progress).toEqual({ done: 3, total: 4 })
  })

  it('returns zero for pitch with no scopes', () => {
    const progress = deriveTotalTaskProgress([], tasks, 'p1')
    expect(progress).toEqual({ done: 0, total: 0 })
  })
})
