import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleListCycles, handleGetCycle, handleGetPitch, handleGetPitchUpdates } from './tools'
import type { StorageJson } from './liveblocks-reader'

vi.mock('./liveblocks-reader', () => ({
  listCycleRooms: vi.fn(),
  getCycleStorage: vi.fn(),
  resolvePitch: vi.fn(),
  slugify: vi.fn((t: string) => t.toLowerCase().replace(/\s+/g, '-')),
}))

import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'

const mockListRooms = vi.mocked(listCycleRooms)
const mockGetStorage = vi.mocked(getCycleStorage)
const mockResolvePitch = vi.mocked(resolvePitch)

const ORG_ID = 'org_test'

const FIXTURE_STORAGE: StorageJson = {
  cycle: { name: 'Q2 Build', type: 'build', start_date: '2026-04-06', end_date: '2026-05-15', slack_channel: '' },
  pitches: [
    { id: 'p1', title: 'Mission Control', stage: 'building', needle: { progress: 0.6, zone: 'on_track' }, frame_problem: 'No visibility', frame_outcome: 'Dashboard', timebox_start: '2026-04-06', timebox_end: '2026-05-15' },
    { id: 'p2', title: 'MCP Server', stage: 'framing', needle: null, frame_problem: '', frame_outcome: '', timebox_start: '2026-04-06', timebox_end: '2026-05-15' },
  ],
  scopes: [
    { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', litmus_text: '', hill_progress: 0.5 },
    { id: 's2', pitchId: 'p1', title: 'API', tier: 'should', litmus_text: '', hill_progress: 0.8 },
    { id: 's3', pitchId: 'p2', title: 'Auth', tier: 'must', litmus_text: '', hill_progress: 0 },
  ],
  tasks: [
    { id: 't1', scopeId: 's1', title: 'Build gauge', done: true },
    { id: 't2', scopeId: 's1', title: 'Add labels', done: false },
    { id: 't3', scopeId: 's2', title: 'Endpoint', done: true },
    { id: 't4', scopeId: 's3', title: 'Setup Clerk', done: false },
  ],
  updates: [
    {
      id: 'u1', pitchId: 'p1', posted_at: '2026-04-15T14:00:00Z', posted_by: 'user1',
      narrative: 'First update', needle_snapshot: { progress: 0.5, zone: 'some_risk' },
      hill_snapshot: [], task_snapshot: [], timebox_snapshot: { daysLeft: 20, currentWeek: 2, totalWeeks: 6 },
    },
    {
      id: 'u2', pitchId: 'p1', posted_at: '2026-04-22T14:00:00Z', posted_by: 'user1',
      narrative: 'Second update', needle_snapshot: { progress: 0.85, zone: 'on_track' },
      hill_snapshot: [], task_snapshot: [], timebox_snapshot: { daysLeft: 13, currentWeek: 3, totalWeeks: 6 },
    },
  ],
  parkingItems: [
    { id: 'pk1', pitchId: 'p1', text: 'Check accessibility', resolved: false },
  ],
}

describe('handleListCycles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cycle summaries as JSON text content', async () => {
    mockListRooms.mockResolvedValue([
      { slug: '2026-q2-build', name: 'Q2 Build', type: 'build', start_date: '2026-04-06', end_date: '2026-05-15' },
    ])

    const result = await handleListCycles(ORG_ID)

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as { slug: string }[]
    expect(data).toHaveLength(1)
    expect(data[0].slug).toBe('2026-q2-build')
  })
})

describe('handleGetCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cycle metadata and pitch summaries', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)

    const result = await handleGetCycle(ORG_ID, '2026-q2-build')

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.cycle.name).toBe('Q2 Build')
    expect(data.pitches).toHaveLength(2)
    expect(data.pitches[0].tasksDone).toBe(2)
    expect(data.pitches[0].tasksTotal).toBe(3)
  })

  it('returns error when room not found', async () => {
    mockGetStorage.mockRejectedValue(new Error('Room not found'))

    const result = await handleGetCycle(ORG_ID, 'nonexistent')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('nonexistent')
  })
})

describe('handleGetPitch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pitch with nested scopes, tasks, and parking items', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'mission-control')

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.pitch.title).toBe('Mission Control')
    expect(data.scopes).toHaveLength(2)
    expect(data.scopes[0].tasks).toHaveLength(2)
    expect(data.parkingItems).toHaveLength(1)
  })

  it('returns error when pitch not found', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(undefined)

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'nonexistent')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('nonexistent')
  })
})

describe('handleGetPitchUpdates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updates sorted newest-first', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])

    const result = await handleGetPitchUpdates(ORG_ID, '2026-q2-build', 'mission-control')

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.updates).toHaveLength(2)
    expect(data.updates[0].id).toBe('u2')
    expect(data.updates[1].id).toBe('u1')
  })
})
