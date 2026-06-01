import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleListCycles, handleGetCycle, handleGetPitch, handleGetPitchUpdates, handleBatch, handleCreateCycle, registerCyclesTools } from './tools'
import type { StorageJson } from './liveblocks-reader'

vi.mock('./liveblocks-reader', () => ({
  listCycleRooms: vi.fn(),
  getCycleStorage: vi.fn(),
  resolvePitch: vi.fn(),
  slugify: vi.fn((t: string) => t.toLowerCase().replace(/\s+/g, '-')),
}))

vi.mock('./liveblocks-writer', () => ({
  createCycle: vi.fn(),
  upsertPitch: vi.fn(),
  upsertScope: vi.fn(),
  upsertTask: vi.fn(),
  upsertParkingItem: vi.fn(),
  deletePitch: vi.fn(),
  deleteScope: vi.fn(),
  deleteTask: vi.fn(),
  deleteParkingItem: vi.fn(),
  deleteUpdate: vi.fn(),
}))

import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { deleteUpdate } from './liveblocks-writer'

const mockListRooms = vi.mocked(listCycleRooms)
const mockGetStorage = vi.mocked(getCycleStorage)
const mockResolvePitch = vi.mocked(resolvePitch)
const mockDeleteUpdate = vi.mocked(deleteUpdate)

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

import {
  createCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
} from './liveblocks-writer'

const mockCreateCycle = vi.mocked(createCycle)
const mockUpsertPitch = vi.mocked(upsertPitch)
const mockUpsertScope = vi.mocked(upsertScope)
const mockUpsertTask = vi.mocked(upsertTask)

const CYCLE_PARAMS = {
  name: '2026 Q3 Build',
  type: 'build',
  start_date: '2026-07-06',
  end_date: '2026-08-14',
  slack_channel: '#product-general',
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

  it('routes delete_update through the writer and surfaces latest-only errors', async () => {
    mockDeleteUpdate.mockResolvedValueOnce(undefined)
    mockDeleteUpdate.mockRejectedValueOnce(
      new Error('Only the latest update can be deleted: "u1" is not the latest update for its pitch')
    )

    const result = await handleBatch(ORG_ID, 'q2-build', [
      { tool: 'delete_update', params: { id: 'u2' } },
      { tool: 'delete_update', params: { id: 'u1' } },
    ])

    const data = JSON.parse(result.content[0].text) as any
    expect(mockDeleteUpdate).toHaveBeenNthCalledWith(1, `${ORG_ID}:cycle:q2-build`, 'u2')
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

  const READ_TOOLS = ['list_cycles', 'get_cycle', 'get_pitch', 'get_pitch_updates']
  const DESTRUCTIVE_TOOLS = ['delete_pitch', 'delete_scope', 'delete_task', 'delete_parking_item', 'delete_update', 'batch']

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
})
