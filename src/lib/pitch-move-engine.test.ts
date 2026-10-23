import { describe, it, expect } from 'vitest'
import { extractPitchBundle, moveConflict } from './pitch-move-engine'
import type { CyclePitch } from '@/cycle-liveblocks.config'

function pitch(id: string, title: string, extra: Partial<CyclePitch> = {}): CyclePitch {
  return {
    id,
    title,
    stage: 'building',
    needle: null,
    frame_problem: '',
   
    timebox_start: '',
    timebox_end: '',
    emoji: '',
    notion_url: '',
    ...extra,
  }
}

const STORAGE = {
  pitches: [pitch('p1', 'Mission Control', { squadId: 'sq1' }), pitch('p2', 'Other')],
  scopes: [
    { id: 's1', pitchId: 'p1', title: 'A', tier: 'must' as const, litmus_text: '', hill_progress: 0 },
    { id: 's2', pitchId: 'p2', title: 'B', tier: 'must' as const, litmus_text: '', hill_progress: 0 },
  ],
  tasks: [
    { id: 't1', scopeId: 's1', pitchId: 'p1', title: 'scoped', done: false },
    { id: 't2', pitchId: 'p1', title: 'unscoped', done: false },
    { id: 't3', scopeId: 's1', title: 'legacy, no pitchId', done: true },
    { id: 't4', scopeId: 's2', pitchId: 'p2', title: 'other pitch', done: false },
    { id: 't5', scopeId: 'gone', pitchId: 'p1', title: 'dangling scope', done: false },
  ],
  updates: [
    { id: 'u1', pitchId: 'p1' },
    { id: 'u2', pitchId: 'p2' },
  ] as never[],
  parkingItems: [
    { id: 'pk1', pitchId: 'p1', text: 'later', resolved: false },
    { id: 'pk2', pitchId: 'p2', text: 'other', resolved: false },
  ],
  squads: [{ id: 'sq1', name: 'Platform', color: '#123456' }],
}

describe('extractPitchBundle', () => {
  it('returns null when the pitch is not in the cycle', () => {
    expect(extractPitchBundle(STORAGE, 'nope')).toBeNull()
  })

  it('collects the pitch and everything that belongs to it, and nothing else', () => {
    const bundle = extractPitchBundle(STORAGE, 'p1')!
    expect(bundle.pitch.id).toBe('p1')
    expect(bundle.scopes.map((s) => s.id)).toEqual(['s1'])
    expect(bundle.tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't5'])
    expect(bundle.updates.map((u) => u.id)).toEqual(['u1'])
    expect(bundle.parkingItems.map((p) => p.id)).toEqual(['pk1'])
    expect(bundle.squad).toEqual({ id: 'sq1', name: 'Platform', color: '#123456' })
  })

  it('reports no squad for an unassigned pitch or a dangling squad id', () => {
    expect(extractPitchBundle(STORAGE, 'p2')!.squad).toBeNull()
    const dangling = { ...STORAGE, pitches: [pitch('p1', 'X', { squadId: 'gone' })] }
    expect(extractPitchBundle(dangling, 'p1')!.squad).toBeNull()
  })

  it('reads a room created before squads existed', () => {
    const { squads: _squads, ...legacy } = STORAGE
    expect(extractPitchBundle(legacy, 'p1')!.squad).toBeNull()
  })
})

describe('moveConflict', () => {
  it('allows a title the target cycle does not use', () => {
    expect(moveConflict([{ id: 'x', title: 'Billing' }], { id: 'p1', title: 'Mission Control' })).toBeNull()
  })

  it('rejects a title whose slug the target cycle already uses', () => {
    expect(
      moveConflict([{ id: 'x', title: 'mission control' }], { id: 'p1', title: 'Mission Control' })
    ).toMatch(/already has a pitch named "mission control"/)
  })

  it('ignores the pitch itself, so a resumed move is not a conflict', () => {
    expect(moveConflict([{ id: 'p1', title: 'Mission Control' }], { id: 'p1', title: 'Mission Control' })).toBeNull()
  })
})
