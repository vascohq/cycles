import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { handleListCycles, handleGetCycle, handleGetPitch, handleListUpdates, handlePreviewUpdate, handlePostUpdate, handleBatch, handleCreateCycle, registerCyclesTools } from './tools'
import type { StorageJson } from './liveblocks-reader'

vi.mock('./liveblocks-reader', () => ({
  listCycleRooms: vi.fn(),
  getCycleStorage: vi.fn(),
  resolvePitch: vi.fn(),
  slugify: vi.fn((t: string) => t.toLowerCase().replace(/\s+/g, '-')),
}))

vi.mock('./liveblocks-writer', () => ({
  createCycle: vi.fn(),
  updateCycle: vi.fn(),
  upsertPitch: vi.fn(),
  upsertScope: vi.fn(),
  upsertTask: vi.fn(),
  moveTask: vi.fn(),
  upsertParkingItem: vi.fn(),
  deletePitch: vi.fn(),
  deleteScope: vi.fn(),
  deleteTask: vi.fn(),
  deleteParkingItem: vi.fn(),
  deleteUpdate: vi.fn(),
  pushUpdate: vi.fn(),
  markSlackDelivered: vi.fn(),
  upsertSquad: vi.fn(),
  deleteSquad: vi.fn(),
  // Batch opens one mutateStorage and runs the callback with a shared root;
  // the mock just invokes it with a dummy root so the ops (mocked above) run.
  openBatch: vi.fn(async (_roomId: string, fn: (root: any) => Promise<void>) => {
    await fn({})
  }),
}))

vi.mock('@/lib/slack-delivery', () => ({
  deliverSlackUpdate: vi.fn(),
  isSlackConfigured: vi.fn(),
}))

// Keep the real (pure) resolveAssigneeRef; only stub the Clerk-backed fetch.
vi.mock('@/lib/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/users')>()),
  getOrganizationUsers: vi.fn(),
}))

import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { deleteUpdate, pushUpdate, markSlackDelivered } from './liveblocks-writer'
import { deliverSlackUpdate, isSlackConfigured } from '@/lib/slack-delivery'
import { getOrganizationUsers } from '@/lib/users'

const mockGetOrgUsers = vi.mocked(getOrganizationUsers)

const mockListRooms = vi.mocked(listCycleRooms)
const mockGetStorage = vi.mocked(getCycleStorage)
const mockResolvePitch = vi.mocked(resolvePitch)
const mockDeleteUpdate = vi.mocked(deleteUpdate)
const mockPushUpdate = vi.mocked(pushUpdate)
const mockMarkSlackDelivered = vi.mocked(markSlackDelivered)
const mockDeliverSlack = vi.mocked(deliverSlackUpdate)
const mockIsSlackConfigured = vi.mocked(isSlackConfigured)

const ORG_ID = 'org_test'

const FIXTURE_STORAGE: StorageJson = {
  cycle: { name: 'Q2 Build', type: 'build', start_date: '2026-04-06', end_date: '2026-05-15' },
  pitches: [
    { id: 'p1', title: 'Mission Control', stage: 'building', needle: { progress: 0.6, zone: 'on_track' }, frame_problem: 'No visibility', frame_outcome: 'Dashboard', timebox_start: '2026-04-06', timebox_end: '2026-05-15', emoji: '', notion_url: '', squadId: 'sq1' },
    { id: 'p2', title: 'MCP Server', stage: 'framing', needle: null, frame_problem: '', frame_outcome: '', timebox_start: '2026-04-06', timebox_end: '2026-05-15', emoji: '', notion_url: '' },
  ],
  squads: [{ id: 'sq1', name: 'Platform', color: '#3e63dd' }],
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

  it('includes the cycle squads and each pitch its squad name', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)

    const result = await handleGetCycle(ORG_ID, '2026-q2-build')

    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.squads).toEqual([{ id: 'sq1', name: 'Platform', color: '#3e63dd' }])
    expect(data.pitches[0].squad).toBe('Platform')
    expect(data.pitches[1].squad).toBeNull()
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

  it('surfaces a task assigneeId, and omits it for an unassigned task', async () => {
    const storage: StorageJson = {
      ...FIXTURE_STORAGE,
      tasks: [
        { id: 't1', scopeId: 's1', title: 'Build gauge', done: true, assigneeId: 'u_simon' },
        { id: 't2', scopeId: 's1', title: 'Add labels', done: false },
      ],
    }
    mockGetStorage.mockResolvedValue(storage)
    mockResolvePitch.mockReturnValue(storage.pitches[0])

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'mission-control')

    const data = JSON.parse(result.content[0].text as string) as any
    const tasks = data.scopes[0].tasks as { id: string; assigneeId?: string }[]
    expect(tasks.find((t) => t.id === 't1')?.assigneeId).toBe('u_simon')
    expect(tasks.find((t) => t.id === 't2')?.assigneeId).toBeUndefined()
  })

  it('returns error when pitch not found', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(undefined)

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'nonexistent')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('nonexistent')
  })

  it('returns core_scope_id and marks the core scope inline', async () => {
    const storage = {
      ...FIXTURE_STORAGE,
      pitches: [
        { ...FIXTURE_STORAGE.pitches[0], core_scope_id: 's2' },
        FIXTURE_STORAGE.pitches[1],
      ],
    }
    mockGetStorage.mockResolvedValue(storage)
    mockResolvePitch.mockReturnValue(storage.pitches[0])

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'mission-control')
    const data = JSON.parse(result.content[0].text as string) as any

    expect(data.pitch.core_scope_id).toBe('s2')
    expect(data.scopes.find((s: any) => s.id === 's2').core).toBe(true)
    expect(data.scopes.find((s: any) => s.id === 's1').core).toBe(false)
  })

  it('resolves a dangling core_scope_id to no core set', async () => {
    const storage = {
      ...FIXTURE_STORAGE,
      pitches: [
        { ...FIXTURE_STORAGE.pitches[0], core_scope_id: 'deleted-scope' },
        FIXTURE_STORAGE.pitches[1],
      ],
    }
    mockGetStorage.mockResolvedValue(storage)
    mockResolvePitch.mockReturnValue(storage.pitches[0])

    const result = await handleGetPitch(ORG_ID, '2026-q2-build', 'mission-control')
    const data = JSON.parse(result.content[0].text as string) as any

    expect(data.pitch.core_scope_id ?? null).toBeNull()
    expect(data.scopes.every((s: any) => !s.core)).toBe(true)
  })
})

describe('handleListUpdates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updates sorted newest-first', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])

    const result = await handleListUpdates(ORG_ID, '2026-q2-build', 'mission-control')

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.updates).toHaveLength(2)
    expect(data.updates[0].id).toBe('u2')
    expect(data.updates[1].id).toBe('u1')
  })
})

const ORG_SLUG = 'vasco'

describe('handlePreviewUpdate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the Slack text, delivery flag, and resolved fields without writing', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])
    mockIsSlackConfigured.mockReturnValue(true)

    const result = await handlePreviewUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'mission-control', {
      progress: 0.7,
      zone: 'on_track',
      narrative: 'Gauge shipped',
    })

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.slack_text).toContain('Mission Control')
    expect(data.slack_text).toContain('Gauge shipped')
    expect(data.would_deliver).toBe(true)
    expect(data.resolved.pitch_url).toBe(
      'http://localhost:3000/vasco/cycles/2026-q2-build/mission-control'
    )
    expect(typeof data.resolved.weekNumber).toBe('number')
    expect(data.resolved.tasksTotal).toBe(3)
    // Pure dry-run: nothing is persisted.
    expect(mockPushUpdate).not.toHaveBeenCalled()
    expect(mockDeliverSlack).not.toHaveBeenCalled()
  })

  it('reports would_deliver:false when Slack is not configured', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])
    mockIsSlackConfigured.mockReturnValue(false)

    const result = await handlePreviewUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'mission-control', {
      progress: 0.7,
      zone: 'on_track',
      narrative: 'Gauge shipped',
    })

    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.would_deliver).toBe(false)
  })

  it('errors when the pitch does not exist', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(undefined)

    const result = await handlePreviewUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'ghost', {
      progress: 0.5,
      zone: 'some_risk',
      narrative: 'x',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('ghost')
  })
})

describe('handlePostUpdate', () => {
  beforeEach(() => vi.clearAllMocks())

  const params = { progress: 0.8, zone: 'on_track' as const, narrative: 'Shipped the gauge' }

  it('persists the update, delivers to Slack, and reports delivered', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])
    mockIsSlackConfigured.mockReturnValue(true)
    mockDeliverSlack.mockResolvedValue({ ok: true, delivered_at: '2026-06-10T10:05:00Z' })

    const result = await handlePostUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'mission-control', 'user_1', params)

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text as string) as any
    expect(typeof data.update_id).toBe('string')
    expect(data.needle).toEqual({ progress: 0.8, zone: 'on_track' })
    expect(data.slack).toBe('delivered')

    expect(mockPushUpdate).toHaveBeenCalledOnce()
    const built = mockPushUpdate.mock.calls[0][1]
    expect(built.slack_attempted).toBe(true)
    expect(built.posted_by).toBe('user_1')
    expect(mockDeliverSlack).toHaveBeenCalledOnce()
    expect(mockMarkSlackDelivered).toHaveBeenCalledWith(
      `${ORG_ID}:cycle:2026-q2-build`,
      data.update_id,
      '2026-06-10T10:05:00Z'
    )
  })

  it('persists the update and reports disabled when Slack is off, without delivering', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])
    mockIsSlackConfigured.mockReturnValue(false)

    const result = await handlePostUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'mission-control', 'user_1', params)

    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.slack).toBe('disabled')
    expect(mockPushUpdate).toHaveBeenCalledOnce()
    expect(mockPushUpdate.mock.calls[0][1].slack_attempted).toBeUndefined()
    expect(mockDeliverSlack).not.toHaveBeenCalled()
    expect(mockMarkSlackDelivered).not.toHaveBeenCalled()
  })

  it('still persists the update but reports failed when delivery fails', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(FIXTURE_STORAGE.pitches[0])
    mockIsSlackConfigured.mockReturnValue(true)
    mockDeliverSlack.mockResolvedValue({ ok: false, error: 'no_service' })

    const result = await handlePostUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'mission-control', 'user_1', params)

    const data = JSON.parse(result.content[0].text as string) as any
    expect(data.slack).toBe('failed')
    expect(mockPushUpdate).toHaveBeenCalledOnce()
    expect(mockMarkSlackDelivered).not.toHaveBeenCalled()
  })

  it('errors when the pitch does not exist', async () => {
    mockGetStorage.mockResolvedValue(FIXTURE_STORAGE)
    mockResolvePitch.mockReturnValue(undefined)

    const result = await handlePostUpdate(ORG_ID, ORG_SLUG, '2026-q2-build', 'ghost', 'user_1', params)

    expect(result.isError).toBe(true)
    expect(mockPushUpdate).not.toHaveBeenCalled()
  })
})

import {
  createCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
  moveTask,
  upsertSquad,
  deleteSquad,
} from './liveblocks-writer'

const mockCreateCycle = vi.mocked(createCycle)
const mockUpsertPitch = vi.mocked(upsertPitch)
const mockUpsertScope = vi.mocked(upsertScope)
const mockUpsertTask = vi.mocked(upsertTask)
const mockMoveTask = vi.mocked(moveTask)
const mockUpsertSquad = vi.mocked(upsertSquad)
const mockDeleteSquad = vi.mocked(deleteSquad)

const CYCLE_PARAMS = {
  name: '2026 Q3 Build',
  type: 'build',
  start_date: '2026-07-06',
  end_date: '2026-08-14',
}

describe('handleCreateCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a cycle with an explicit slug and returns created:true', async () => {
    mockCreateCycle.mockResolvedValue({ created: true })

    const result = await handleCreateCycle(ORG_ID, 'user_1', '2026-q3-build', CYCLE_PARAMS)

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text) as any
    expect(data.created).toBe(true)
    expect(data.slug).toBe('2026-q3-build')
    expect(mockCreateCycle).toHaveBeenCalledWith(
      `${ORG_ID}:cycle:2026-q3-build`,
      'user_1',
      CYCLE_PARAMS
    )
  })

  it('derives the slug from the name when none is given', async () => {
    mockCreateCycle.mockResolvedValue({ created: true })

    const result = await handleCreateCycle(ORG_ID, 'user_1', undefined, CYCLE_PARAMS)

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text) as any
    expect(data.slug).toBe('2026-q3-build')
    expect(mockCreateCycle).toHaveBeenCalledWith(
      `${ORG_ID}:cycle:2026-q3-build`,
      'user_1',
      CYCLE_PARAMS
    )
  })

  it('rejects an unusable slug without touching storage', async () => {
    const result = await handleCreateCycle(ORG_ID, 'user_1', 'Bad Slug', CYCLE_PARAMS)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Could not derive a valid cycle slug')
    expect(mockCreateCycle).not.toHaveBeenCalled()
  })

  it('returns an error when a name slugifies to nothing', async () => {
    const result = await handleCreateCycle(ORG_ID, 'user_1', undefined, {
      ...CYCLE_PARAMS,
      name: '!!!',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Could not derive a valid cycle slug')
    expect(mockCreateCycle).not.toHaveBeenCalled()
  })

  it('returns an error when the cycle already exists', async () => {
    mockCreateCycle.mockResolvedValue({ created: false })

    const result = await handleCreateCycle(ORG_ID, 'user_1', '2026-q3-build', CYCLE_PARAMS)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('already exists')
  })
})

describe('handleBatch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('executes operations sequentially and returns all results', async () => {
    mockUpsertPitch.mockResolvedValue({ created: true, id: 'p1' })
    mockUpsertScope.mockResolvedValue({ created: true, id: 's1' })
    mockUpsertTask.mockResolvedValue({ created: true, id: 't1' })

    const result = await handleBatch(ORG_ID, 'q2-build', [
      {
        tool: 'upsert_pitch',
        params: {
          title: 'New Pitch',
          stage: 'framing',
          frame_problem: '',
          frame_outcome: '',
          timebox_start: '2026-04-06',
          timebox_end: '2026-05-15',
        },
      },
      {
        tool: 'upsert_scope',
        params: { pitchId: 'p1', title: 'Scope A', tier: 'must', litmus_text: '', hill_progress: 0 },
      },
      {
        tool: 'upsert_task',
        params: { scopeId: 's1', title: 'Task 1', done: false },
      },
    ])

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text) as any
    expect(data.results).toHaveLength(3)
    expect(data.results[0].ok).toBe(true)
    expect(data.results[0].id).toBe('p1')
    expect(data.results[1].ok).toBe(true)
    expect(data.results[2].ok).toBe(true)
  })

  it('dispatches upsert_squad and delete_squad', async () => {
    mockUpsertSquad.mockResolvedValue({ created: true, id: 'sq1' })
    mockDeleteSquad.mockResolvedValue(undefined)

    const result = await handleBatch(ORG_ID, 'q2-build', [
      { tool: 'upsert_squad', params: { name: 'Platform' } },
      { tool: 'delete_squad', params: { id: 'sq2' } },
    ])

    const data = JSON.parse(result.content[0].text) as any
    expect(data.results[0]).toMatchObject({ ok: true, tool: 'upsert_squad', id: 'sq1' })
    expect(data.results[1]).toMatchObject({ ok: true, tool: 'delete_squad' })
    // Third arg is the shared batch root threaded by handleBatch.
    expect(mockUpsertSquad).toHaveBeenCalledWith('org_test:cycle:q2-build', { name: 'Platform' }, expect.anything())
    expect(mockDeleteSquad).toHaveBeenCalledWith('org_test:cycle:q2-build', 'sq2', expect.anything())
  })

  it('returns partial failure — successful ops persist, failed ones return errors', async () => {
    mockUpsertPitch.mockResolvedValue({ created: true, id: 'p1' })
    mockUpsertScope.mockRejectedValue(new Error('Pitch not found: "bad"'))
    mockUpsertTask.mockResolvedValue({ created: true, id: 't1' })

    const result = await handleBatch(ORG_ID, 'q2-build', [
      {
        tool: 'upsert_pitch',
        params: {
          title: 'Good Pitch',
          stage: 'framing',
          frame_problem: '',
          frame_outcome: '',
          timebox_start: '',
          timebox_end: '',
        },
      },
      {
        tool: 'upsert_scope',
        params: { pitchId: 'bad', title: 'X', tier: 'must', litmus_text: '', hill_progress: 0 },
      },
      {
        tool: 'upsert_task',
        params: { scopeId: 's1', title: 'Task', done: false },
      },
    ])

    expect(result.isError).toBeUndefined()
    const data = JSON.parse(result.content[0].text) as any
    expect(data.results).toHaveLength(3)
    expect(data.results[0].ok).toBe(true)
    expect(data.results[1].ok).toBe(false)
    expect(data.results[1].error).toContain('Pitch not found')
    expect(data.results[2].ok).toBe(true)
  })

  it('routes undo_update through the writer and surfaces latest-only errors', async () => {
    mockDeleteUpdate.mockResolvedValueOnce(undefined)
    mockDeleteUpdate.mockRejectedValueOnce(
      new Error('Only the latest update can be deleted: "u1" is not the latest update for its pitch')
    )

    const result = await handleBatch(ORG_ID, 'q2-build', [
      { tool: 'undo_update', params: { id: 'u2' } },
      { tool: 'undo_update', params: { id: 'u1' } },
    ])

    const data = JSON.parse(result.content[0].text) as any
    expect(mockDeleteUpdate).toHaveBeenNthCalledWith(1, `${ORG_ID}:cycle:q2-build`, 'u2', expect.anything())
    expect(data.results[0].ok).toBe(true)
    expect(data.results[1].ok).toBe(false)
    expect(data.results[1].error).toContain('latest update')
  })

  it('rejects unknown tool names', async () => {
    const result = await handleBatch(ORG_ID, 'q2-build', [
      { tool: 'unknown_tool', params: {} },
    ])

    const data = JSON.parse(result.content[0].text) as any
    expect(data.results[0].ok).toBe(false)
    expect(data.results[0].error).toContain('Unknown tool')
  })
})

// Locks in the requirement that every MCP tool carries annotations so clients
// (e.g. Claude) can split them into read vs. write groups and render a title.
// A new tool registered without valid annotations fails here.
describe('tool annotations', () => {
  type Registered = { name: string; description: string; annotations: any }

  function collectTools(): Registered[] {
    const tools: Registered[] = []
    const server = {
      tool(name: string, description: string, _schema: unknown, annotations: any) {
        tools.push({ name, description, annotations })
      },
    }
    registerCyclesTools(server)
    return tools
  }

  const READ_TOOLS = ['list_cycles', 'get_cycle', 'get_pitch', 'list_updates', 'preview_update', 'list_members']
  const DESTRUCTIVE_TOOLS = ['delete_pitch', 'delete_scope', 'delete_task', 'delete_parking_item', 'undo_update', 'batch']

  it('registers every tool with a title and explicit readOnlyHint', () => {
    const tools = collectTools()
    expect(tools.length).toBeGreaterThan(0)
    for (const tool of tools) {
      expect(tool.annotations, `${tool.name} is missing annotations`).toBeDefined()
      expect(typeof tool.annotations.title, `${tool.name}.title`).toBe('string')
      expect(tool.annotations.title.length).toBeGreaterThan(0)
      expect(typeof tool.annotations.readOnlyHint, `${tool.name}.readOnlyHint`).toBe('boolean')
    }
  })

  it('marks query tools read-only and mutating tools writable', () => {
    const byName = Object.fromEntries(collectTools().map((t) => [t.name, t.annotations]))
    for (const name of READ_TOOLS) {
      expect(byName[name]?.readOnlyHint, `${name} should be read-only`).toBe(true)
    }
    for (const name of Object.keys(byName).filter((n) => !READ_TOOLS.includes(n))) {
      expect(byName[name]?.readOnlyHint, `${name} should be writable`).toBe(false)
    }
  })

  it('flags delete and batch tools as destructive', () => {
    const byName = Object.fromEntries(collectTools().map((t) => [t.name, t.annotations]))
    for (const name of DESTRUCTIVE_TOOLS) {
      expect(byName[name]?.destructiveHint, `${name} should be destructive`).toBe(true)
    }
  })

  it('marks post_update as the only outward-facing tool (reaches Slack)', () => {
    const byName = Object.fromEntries(collectTools().map((t) => [t.name, t.annotations]))
    expect(byName['post_update']?.openWorldHint, 'post_update reaches Slack').toBe(true)
    for (const name of Object.keys(byName).filter((n) => n !== 'post_update')) {
      expect(byName[name]?.openWorldHint ?? false, `${name} only touches Liveblocks`).toBe(false)
    }
  })
})

describe('upsert_* partial-update schemas', () => {
  function schemaFor(toolName: string): Record<string, z.ZodTypeAny> {
    let captured: Record<string, z.ZodTypeAny> | undefined
    const server = {
      tool(name: string, _description: string, schema: Record<string, z.ZodTypeAny>) {
        if (name === toolName) captured = schema
      },
    }
    registerCyclesTools(server)
    if (!captured) throw new Error(`tool not registered: ${toolName}`)
    return captured
  }

  it('upsert_pitch does NOT default omitted fields to "" (regression: wiped timeboxes)', () => {
    // Root cause of the prod incident: timebox_start/end were `.default("")`, so a
    // partial update (e.g. assigning a squad) silently overwrote them with "".
    // Omitting them must leave them `undefined` so the writer can preserve.
    const parsed = z.object(schemaFor('upsert_pitch')).parse({
      cycle_slug: 'q2-build',
      id: 'p1',
      title: 'Mission Control',
      stage: 'building',
    })

    expect(parsed.timebox_start).toBeUndefined()
    expect(parsed.timebox_end).toBeUndefined()
    expect(parsed.frame_problem).toBeUndefined()
    expect(parsed.frame_outcome).toBeUndefined()
    expect(parsed.emoji).toBeUndefined()
    expect(parsed.notion_url).toBeUndefined()
  })

  it('upsert_scope does NOT default omitted litmus_text/hill_progress', () => {
    const parsed = z.object(schemaFor('upsert_scope')).parse({
      cycle_slug: 'q2-build',
      id: 's1',
      pitchId: 'p1',
      title: 'UI',
      tier: 'must',
    })

    expect(parsed.litmus_text).toBeUndefined()
    expect(parsed.hill_progress).toBeUndefined()
    // core is a partial-update flag too: omit = leave the pitch's core unchanged.
    expect(parsed.core).toBeUndefined()
  })

  it('upsert_scope accepts an explicit core flag', () => {
    const schema = z.object(schemaFor('upsert_scope'))
    expect(
      schema.parse({
        cycle_slug: 'q2-build',
        id: 's1',
        pitchId: 'p1',
        title: 'UI',
        tier: 'must',
        core: true,
      }).core
    ).toBe(true)
  })

  it('upsert_task does NOT default omitted done', () => {
    const parsed = z.object(schemaFor('upsert_task')).parse({
      cycle_slug: 'q2-build',
      id: 't1',
      scopeId: 's1',
      title: 'Build gauge',
    })

    expect(parsed.done).toBeUndefined()
  })

  it('upsert_parking_item does NOT default omitted resolved', () => {
    const parsed = z.object(schemaFor('upsert_parking_item')).parse({
      cycle_slug: 'q2-build',
      id: 'pk1',
      pitchId: 'p1',
      text: 'Check a11y',
    })

    expect(parsed.resolved).toBeUndefined()
  })

  it('update_cycle does NOT default any omitted field (so a patch never wipes others)', () => {
    const parsed = z.object(schemaFor('update_cycle')).parse({
      slug_path: 'q2-build',
    })

    expect(parsed.name).toBeUndefined()
    expect(parsed.type).toBeUndefined()
    expect(parsed.start_date).toBeUndefined()
    expect(parsed.end_date).toBeUndefined()
  })

  it('update_cycle type only accepts build or cooldown', () => {
    const schema = z.object(schemaFor('update_cycle'))
    expect(schema.parse({ slug_path: 'q2-build', type: 'cooldown' }).type).toBe('cooldown')
    expect(() => schema.parse({ slug_path: 'q2-build', type: 'sprint' })).toThrow()
  })
})

describe('task assignment & reordering via registered tools', () => {
  // Capture a registered tool's handler (5th arg to server.tool) so we can drive
  // it directly with a fake auth `extra`.
  function handlerFor(toolName: string) {
    let handler:
      | ((args: any, extra: any) => Promise<{ content: { text: string }[]; isError?: true }>)
      | undefined
    const server = {
      tool(name: string, _d: string, _s: unknown, _a: unknown, fn: any) {
        if (name === toolName) handler = fn
      },
    }
    registerCyclesTools(server)
    if (!handler) throw new Error(`tool not registered: ${toolName}`)
    return handler
  }

  const EXTRA = { authInfo: { extra: { memberships: [{ id: 'org_test', slug: 'vasco' }] } } }
  const SIMON = {
    userId: 'user_simon', email: 'simon@vasco.app', name: 'Simon',
    initials: 'SI', hasImage: false, imageUrl: '',
  }

  beforeEach(() => vi.clearAllMocks())

  it('resolves an assignee email to a userId and assigns', async () => {
    mockGetOrgUsers.mockResolvedValue([SIMON])
    mockUpsertTask.mockResolvedValue({ created: false, id: 't1' })
    await handlerFor('upsert_task')(
      { cycle_slug: 'q2-build', id: 't1', scopeId: 's1', title: 'X', assignee: 'simon@vasco.app' },
      EXTRA
    )
    expect(mockUpsertTask).toHaveBeenCalledWith(
      'org_test:cycle:q2-build',
      expect.objectContaining({ assigneeId: 'user_simon' })
    )
  })

  it('rejects an unknown assignee without writing', async () => {
    mockGetOrgUsers.mockResolvedValue([SIMON])
    const res = await handlerFor('upsert_task')(
      { cycle_slug: 'q2-build', id: 't1', scopeId: 's1', title: 'X', assignee: 'ghost@example.com' },
      EXTRA
    )
    expect(res.isError).toBe(true)
    expect(mockUpsertTask).not.toHaveBeenCalled()
  })

  it('passes assigneeId="" to unassign without fetching members', async () => {
    mockUpsertTask.mockResolvedValue({ created: false, id: 't1' })
    await handlerFor('upsert_task')(
      { cycle_slug: 'q2-build', id: 't1', scopeId: 's1', title: 'X', assignee: '' },
      EXTRA
    )
    expect(mockUpsertTask).toHaveBeenCalledWith(
      'org_test:cycle:q2-build',
      expect.objectContaining({ assigneeId: '' })
    )
    expect(mockGetOrgUsers).not.toHaveBeenCalled()
  })

  it('leaves assignee unchanged (assigneeId undefined) when omitted', async () => {
    mockUpsertTask.mockResolvedValue({ created: false, id: 't1' })
    await handlerFor('upsert_task')(
      { cycle_slug: 'q2-build', id: 't1', scopeId: 's1', title: 'X' },
      EXTRA
    )
    expect(mockUpsertTask).toHaveBeenCalledWith(
      'org_test:cycle:q2-build',
      expect.objectContaining({ assigneeId: undefined })
    )
    expect(mockGetOrgUsers).not.toHaveBeenCalled()
  })

  it('move_task forwards before/after to the writer', async () => {
    mockMoveTask.mockResolvedValue({ moved: true })
    await handlerFor('move_task')(
      { cycle_slug: 'q2-build', id: 'a', after: 'b' },
      EXTRA
    )
    expect(mockMoveTask).toHaveBeenCalledWith('org_test:cycle:q2-build', { id: 'a', after: 'b' })
  })

  it('list_members returns userId, name, email', async () => {
    mockGetOrgUsers.mockResolvedValue([SIMON])
    const res = await handlerFor('list_members')({}, EXTRA)
    const data = JSON.parse(res.content[0].text)
    expect(data).toEqual([{ userId: 'user_simon', name: 'Simon', email: 'simon@vasco.app' }])
  })
})
