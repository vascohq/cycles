import { describe, it, expect } from 'vitest'
import {
  deriveScopeGridItems,
  deriveHillScopes,
  deriveParkingLotItems,
  deriveTotalTaskProgress,
  resolveCoreScopeId,
  shouldShowCoreScopePrompt,
  areAllScopesDone,
  pageCelebration,
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

  it('marks only the core scope isCore, leaving tier and order untouched', () => {
    const items = deriveScopeGridItems([scope1, scope2], tasks, 'p1', 's2')
    const s1 = items.find((i) => i.id === 's1')!
    const s2 = items.find((i) => i.id === 's2')!
    expect(s1.isCore).toBe(false)
    expect(s2.isCore).toBe(true)
    // Core is independent of tier and build order (see ADR 0012).
    expect(s1.tier).toBe('must')
    expect(s1.order).toBe(1)
    expect(s2.tier).toBe('should')
    expect(s2.order).toBe(2)
  })

  it('marks no scope isCore when the core pointer is dangling or unset', () => {
    const dangling = deriveScopeGridItems([scope1, scope2], tasks, 'p1', 'gone')
    expect(dangling.every((i) => !i.isCore)).toBe(true)
    const unset = deriveScopeGridItems([scope1, scope2], tasks, 'p1')
    expect(unset.every((i) => !i.isCore)).toBe(true)
  })

  it('marks a scope done when its hill progress reaches the foot (1)', () => {
    const doneScope: CycleScope = { ...scope1, hill_progress: 1 }
    const items = deriveScopeGridItems([doneScope, scope2], tasks, 'p1')
    expect(items[0].done).toBe(true)
    expect(items[1].done).toBe(false)
  })
})

describe('resolveCoreScopeId', () => {
  it('returns the pointer when it matches a live scope', () => {
    expect(resolveCoreScopeId('s2', [scope1, scope2])).toBe('s2')
  })

  it('returns null when the pointer is dangling (scope deleted)', () => {
    expect(resolveCoreScopeId('gone', [scope1, scope2])).toBeNull()
  })

  it('returns null when no core is set', () => {
    expect(resolveCoreScopeId(undefined, [scope1, scope2])).toBeNull()
  })
})

describe('shouldShowCoreScopePrompt', () => {
  it('prompts when the pitch has scopes but none is core', () => {
    expect(
      shouldShowCoreScopePrompt([{ isCore: false }, { isCore: false }])
    ).toBe(true)
  })

  it('does not prompt when a scope is already core', () => {
    expect(
      shouldShowCoreScopePrompt([{ isCore: false }, { isCore: true }])
    ).toBe(false)
  })

  it('does not prompt when the pitch has no scopes', () => {
    expect(shouldShowCoreScopePrompt([])).toBe(false)
  })
})

describe('areAllScopesDone', () => {
  it('is true when every scope is done, regardless of pitch stage', () => {
    expect(areAllScopesDone([{ done: true }, { done: true }])).toBe(true)
  })

  it('is false when any scope is still in progress', () => {
    expect(areAllScopesDone([{ done: true }, { done: false }])).toBe(false)
  })

  it('is false for a pitch with no scopes', () => {
    expect(areAllScopesDone([])).toBe(false)
  })
})

describe('pageCelebration', () => {
  it('is gold when the needle is at 100%', () => {
    expect(pageCelebration(1, true)).toBe('gold')
  })

  it('is gold on the needle reaching 100% even before that, regardless of scopes', () => {
    expect(pageCelebration(1, false)).toBe('gold')
  })

  it('is color when all scopes are done but the needle is not yet at 100%', () => {
    expect(pageCelebration(0.5, true)).toBe('color')
  })

  it('is color when all scopes are done and the needle is unset', () => {
    expect(pageCelebration(null, true)).toBe('color')
  })

  it('is none when scopes are unfinished and the needle is below 100%', () => {
    expect(pageCelebration(0.5, false)).toBe('none')
    expect(pageCelebration(null, false)).toBe('none')
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
      color: '#E54D2E',
      isCore: false,
    })
    expect(hillScopes[1].order).toBe(2)
  })

  it('marks only the core scope isCore, and none when the pointer is dangling or unset', () => {
    const core = deriveHillScopes([scope1, scope2], 'p1', 's2')
    expect(core.find((s) => s.id === 's1')!.isCore).toBe(false)
    expect(core.find((s) => s.id === 's2')!.isCore).toBe(true)
    expect(
      deriveHillScopes([scope1, scope2], 'p1', 'gone').some((s) => s.isCore)
    ).toBe(false)
    expect(
      deriveHillScopes([scope1, scope2], 'p1').some((s) => s.isCore)
    ).toBe(false)
  })

  it('fills a color for a scope that has none, without colliding with a stored sibling', () => {
    // scope1 has stored '#E54D2E'; scope2 has no color and must get a unique one.
    const hillScopes = deriveHillScopes([scope1, scope2], 'p1')
    expect(hillScopes[0].color).toBe('#E54D2E')
    expect(hillScopes[1].color).toBeTruthy()
    expect(hillScopes[1].color).not.toBe('#E54D2E')
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
