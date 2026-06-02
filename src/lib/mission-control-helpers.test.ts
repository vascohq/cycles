import { describe, it, expect } from 'vitest'
import {
  derivePitchCards,
  partitionByStage,
  sortByStageProgression,
} from './mission-control-helpers'
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  PitchUpdate,
  Stage,
} from '@/cycle-liveblocks.config'
import type { PitchCard } from './mission-control-helpers'

const pitches: CyclePitch[] = [
  {
    id: 'p1',
    title: 'Redesign dashboard',
    stage: 'building',
    needle: { progress: 0.6, zone: 'on_track' },
    frame_problem: '',
    frame_outcome: '',
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
    emoji: '',
    notion_url: '',
  },
  {
    id: 'p2',
    title: 'Shipped onboarding',
    stage: 'done',
    needle: { progress: 0.9, zone: 'on_track' },
    frame_problem: '',
    frame_outcome: '',
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
    emoji: '',
    notion_url: '',
  },
]

const scopes: CycleScope[] = [
  { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', litmus_text: '', hill_progress: 0.4, color: '' },
  { id: 's2', pitchId: 'p1', title: 'API', tier: 'should', litmus_text: '', hill_progress: 0.8, color: '' },
  { id: 's3', pitchId: 'p2', title: 'Flow', tier: 'must', litmus_text: '', hill_progress: 1.0, color: '' },
]

const tasks: ScopeTask[] = [
  { id: 't1', scopeId: 's1', title: 'a', done: true },
  { id: 't2', scopeId: 's1', title: 'b', done: false },
  { id: 't3', scopeId: 's2', title: 'c', done: true },
  { id: 't4', scopeId: 's3', title: 'd', done: true },
]

const updates: PitchUpdate[] = [
  {
    id: 'u1',
    pitchId: 'p1',
    posted_at: '2025-01-21T14:30:00Z',
    posted_by: 'user1',
    narrative: 'Good progress',
    needle_snapshot: { progress: 0.6, zone: 'on_track' },
    hill_snapshot: [],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 20, currentWeek: 3, totalWeeks: 6 },
  },
]

describe('derivePitchCards', () => {
  it('derives card data for each pitch with task counts and latest update', () => {
    const cards = derivePitchCards(pitches, scopes, tasks, updates)

    expect(cards).toHaveLength(2)

    const p1Card = cards.find((c) => c.id === 'p1')!
    expect(p1Card.title).toBe('Redesign dashboard')
    expect(p1Card.stage).toBe('building')
    expect(p1Card.needle).toEqual({ progress: 0.6, zone: 'on_track' })
    expect(p1Card.tasksDone).toBe(2)
    expect(p1Card.tasksTotal).toBe(3)
    expect(p1Card.lastUpdatedAt).toBe('2025-01-21T14:30:00Z')

    const p2Card = cards.find((c) => c.id === 'p2')!
    expect(p2Card.tasksDone).toBe(1)
    expect(p2Card.tasksTotal).toBe(1)
    expect(p2Card.lastUpdatedAt).toBeNull()
  })
})

describe('partitionByStage', () => {
  it('separates in-flight from done pitches', () => {
    const cards = derivePitchCards(pitches, scopes, tasks, updates)
    const { inFlight, done } = partitionByStage(cards)

    expect(inFlight).toHaveLength(1)
    expect(inFlight[0].id).toBe('p1')
    expect(done).toHaveLength(1)
    expect(done[0].id).toBe('p2')
  })
})

describe('sortByStageProgression', () => {
  const card = (id: string, stage: Stage): PitchCard => ({
    id,
    title: id,
    emoji: '',
    stage,
    needle: null,
    tasksDone: 0,
    tasksTotal: 0,
    scopesTotal: 0,
    lastUpdatedAt: null,
    timebox_start: '',
    timebox_end: '',
  })

  it('orders building → shaping → framing → done', () => {
    const sorted = sortByStageProgression([
      card('a', 'framing'),
      card('b', 'done'),
      card('c', 'building'),
      card('d', 'shaping'),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['c', 'd', 'a', 'b'])
  })

  it('keeps done pitches last', () => {
    const sorted = sortByStageProgression([
      card('done1', 'done'),
      card('build1', 'building'),
    ])
    expect(sorted[sorted.length - 1].stage).toBe('done')
  })

  it('is stable within the same stage (preserves input order)', () => {
    const sorted = sortByStageProgression([
      card('b1', 'building'),
      card('b2', 'building'),
      card('b3', 'building'),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('does not mutate the input array', () => {
    const input = [card('a', 'framing'), card('b', 'building')]
    const before = input.map((c) => c.id)
    sortByStageProgression(input)
    expect(input.map((c) => c.id)).toEqual(before)
  })
})
