import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    mutateStorage: vi.fn(),
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    initializeStorageDocument: vi.fn(),
    deleteRoom: vi.fn(),
  },
}))

import { liveblocks } from '@/lib/liveblocks'
import {
  createCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
  upsertParkingItem,
  deletePitch,
  deleteScope,
  deleteTask,
  deleteParkingItem,
  deleteUpdate,
  pushUpdate,
  markSlackDelivered,
  upsertSquad,
} from './liveblocks-writer'
import { SCOPE_PALETTE } from '@/lib/color-engine'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

const mockGetRoom = vi.mocked(liveblocks.getRoom)
const mockCreateRoom = vi.mocked(liveblocks.createRoom)
const mockInitStorage = vi.mocked(liveblocks.initializeStorageDocument)

const mockMutateStorage = vi.mocked(liveblocks.mutateStorage)

type MockItem = Record<string, unknown> & {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

function makeMockItem(data: Record<string, unknown>): MockItem {
  const store = { ...data }
  return {
    ...store,
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value
    },
  }
}

// Mirror real Liveblocks semantics: a LiveList<LiveObject<X>> only stores items
// as proper LiveObjects when pushed via `new LiveObject(...)`. A plain JS object
// would be wrapped in an opaque LiveRegister, and the writer's later .get('id')
// reads would crash. The previous lenient mock accepted plain objects, hiding
// that bug — so reject anything that isn't a LiveObject-shaped instance.
function toMockItem(item: unknown): MockItem {
  if (
    !item ||
    typeof item !== 'object' ||
    typeof (item as { get?: unknown }).get !== 'function' ||
    typeof (item as { keys?: unknown }).keys !== 'function'
  ) {
    throw new Error(
      'LiveList items must be wrapped in `new LiveObject(...)` before pushing'
    )
  }
  const live = item as { get: (k: string) => unknown; keys: () => Iterable<string> }
  const data: Record<string, unknown> = {}
  for (const key of live.keys()) data[key] = live.get(key)
  return makeMockItem(data)
}

function makeMockList(items: MockItem[]) {
  return {
    push: (item: unknown) => items.push(toMockItem(item)),
    find: (fn: (item: MockItem) => boolean) => items.find(fn),
    filter: (fn: (item: MockItem) => boolean) => items.filter(fn),
    toArray: () => items,
    delete: (index: number) => items.splice(index, 1),
    findIndex: (fn: (item: MockItem) => boolean) => items.findIndex(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  }
}

type StorageData = {
  pitches?: MockItem[]
  scopes?: MockItem[]
  tasks?: MockItem[]
  parkingItems?: MockItem[]
  updates?: MockItem[]
  squads?: MockItem[]
}

function setupStorage(data: StorageData = {}) {
  const storage = {
    pitches: makeMockList(data.pitches ?? []),
    scopes: makeMockList(data.scopes ?? []),
    tasks: makeMockList(data.tasks ?? []),
    parkingItems: makeMockList(data.parkingItems ?? []),
    updates: makeMockList(data.updates ?? []),
    squads: makeMockList(data.squads ?? []),
  }

  mockMutateStorage.mockImplementation(async (_roomId, callback) => {
    const root = {
      get: (key: string) => (storage as any)[key],
    }
    await callback({ root } as any)
  })

  return storage
}

const ROOM = 'org_1:cycle:q2-build'

const CYCLE_PARAMS = {
  name: 'Q3 Build',
  type: 'build',
  start_date: '2026-07-06',
  end_date: '2026-08-14',
  slack_channel: '#product-general',
}

describe('createCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the room and initializes storage when it does not exist', async () => {
    mockGetRoom.mockRejectedValue(new Error('Room not found'))

    const result = await createCycle(ROOM, 'user_1', CYCLE_PARAMS)

    expect(result.created).toBe(true)
    expect(mockCreateRoom).toHaveBeenCalledTimes(1)
    const [roomId, opts] = mockCreateRoom.mock.calls[0]
    expect(roomId).toBe(ROOM)
    expect((opts as any).metadata.title).toBe('Q3 Build')
    expect((opts as any).metadata.createdBy).toBe('user_1')
    expect((opts as any).metadata.type).toBe('build')

    expect(mockInitStorage).toHaveBeenCalledTimes(1)
    const [, doc] = mockInitStorage.mock.calls[0]
    expect((doc as any).data.cycle.data.name).toBe('Q3 Build')
    expect((doc as any).data.pitches).toEqual({ liveblocksType: 'LiveList', data: [] })
  })

  it('is idempotent — returns created:false and does not clobber an existing room', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)

    const result = await createCycle(ROOM, 'user_1', CYCLE_PARAMS)

    expect(result.created).toBe(false)
    expect(mockCreateRoom).not.toHaveBeenCalled()
    expect(mockInitStorage).not.toHaveBeenCalled()
  })
})

describe('upsertPitch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new pitch when no id provided', async () => {
    const storage = setupStorage()

    const result = await upsertPitch(ROOM, {
      title: 'Mission Control',
      stage: 'framing',
      frame_problem: 'No visibility',
      frame_outcome: 'Dashboard',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
      emoji: '',
      notion_url: '',
    })

    expect(result.created).toBe(true)
    expect(result.id).toBeDefined()
    expect(storage.pitches.toArray()).toHaveLength(1)
    const pitch = storage.pitches.toArray()[0]
    expect(pitch.title).toBe('Mission Control')
    expect(pitch.needle).toBeNull()
  })

  it('updates an existing pitch when id is provided', async () => {
    const existing = makeMockItem({ id: 'p1', title: 'Old', stage: 'framing' })
    setupStorage({ pitches: [existing] })

    const result = await upsertPitch(ROOM, {
      id: 'p1',
      title: 'New Title',
      stage: 'building',
      frame_problem: 'Updated',
      frame_outcome: 'Updated',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
      emoji: '',
      notion_url: '',
    })

    expect(result.created).toBe(false)
    expect(result.id).toBe('p1')
    expect(existing.get('title')).toBe('New Title')
    expect(existing.get('stage')).toBe('building')
  })

  it('throws when updating a pitch with unknown id', async () => {
    setupStorage()

    await expect(
      upsertPitch(ROOM, {
        id: 'nonexistent',
        title: 'X',
        stage: 'framing',
        frame_problem: '',
        frame_outcome: '',
        timebox_start: '',
        timebox_end: '',
        emoji: '',
        notion_url: '',
      })
    ).rejects.toThrow('not found')
  })
})

describe('upsertScope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new scope under an existing pitch', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'Mission Control' })
    const storage = setupStorage({ pitches: [pitch] })

    const result = await upsertScope(ROOM, {
      pitchId: 'p1',
      title: 'UI Layer',
      tier: 'must',
      litmus_text: 'User can see the dashboard',
      hill_progress: 0,
    })

    expect(result.created).toBe(true)
    expect(result.id).toBeDefined()
    expect(storage.scopes.toArray()).toHaveLength(1)
    const scope = storage.scopes.toArray()[0]
    expect(scope.title).toBe('UI Layer')
    expect(scope.pitchId).toBe('p1')
    expect(scope.tier).toBe('must')
  })

  it('throws when pitchId does not exist', async () => {
    setupStorage()

    await expect(
      upsertScope(ROOM, {
        pitchId: 'nonexistent',
        title: 'X',
        tier: 'must',
        litmus_text: '',
        hill_progress: 0,
      })
    ).rejects.toThrow('Pitch not found')
  })
})

describe('upsertTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new task under an existing scope', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })
    const storage = setupStorage({ scopes: [scope] })

    const result = await upsertTask(ROOM, {
      scopeId: 's1',
      title: 'Build gauge',
      done: false,
    })

    expect(result.created).toBe(true)
    expect(storage.tasks.toArray()).toHaveLength(1)
    expect(storage.tasks.toArray()[0].title).toBe('Build gauge')
    expect(storage.tasks.toArray()[0].scopeId).toBe('s1')
  })

  it('throws when scopeId does not exist', async () => {
    setupStorage()

    await expect(
      upsertTask(ROOM, {
        scopeId: 'nonexistent',
        title: 'X',
        done: false,
      })
    ).rejects.toThrow('Scope not found')
  })
})

describe('upsertParkingItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a parking item under an existing pitch', async () => {
    const pitch = makeMockItem({ id: 'p1' })
    const storage = setupStorage({ pitches: [pitch] })

    const result = await upsertParkingItem(ROOM, {
      pitchId: 'p1',
      text: 'Check accessibility',
      resolved: false,
    })

    expect(result.created).toBe(true)
    expect(storage.parkingItems.toArray()).toHaveLength(1)
    expect(storage.parkingItems.toArray()[0].text).toBe('Check accessibility')
  })
})

describe('deletePitch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a pitch by id', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'Mission Control' })
    const storage = setupStorage({ pitches: [pitch] })

    await deletePitch(ROOM, 'p1')

    expect(storage.pitches.toArray()).toHaveLength(0)
  })

  it('throws when pitch not found', async () => {
    setupStorage()
    await expect(deletePitch(ROOM, 'nonexistent')).rejects.toThrow('not found')
  })
})

describe('deleteScope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a scope and its tasks', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1' })
    const task1 = makeMockItem({ id: 't1', scopeId: 's1', title: 'A' })
    const task2 = makeMockItem({ id: 't2', scopeId: 's1', title: 'B' })
    const task3 = makeMockItem({ id: 't3', scopeId: 's2', title: 'C' })
    const storage = setupStorage({
      scopes: [scope],
      tasks: [task1, task2, task3],
    })

    await deleteScope(ROOM, 's1')

    expect(storage.scopes.toArray()).toHaveLength(0)
    expect(storage.tasks.toArray()).toHaveLength(1)
    expect(storage.tasks.toArray()[0].get('id')).toBe('t3')
  })
})

describe('deleteTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a task by id', async () => {
    const task = makeMockItem({ id: 't1', scopeId: 's1' })
    const storage = setupStorage({ tasks: [task] })

    await deleteTask(ROOM, 't1')

    expect(storage.tasks.toArray()).toHaveLength(0)
  })
})

describe('deleteParkingItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a parking item by id', async () => {
    const item = makeMockItem({ id: 'pk1', pitchId: 'p1' })
    const storage = setupStorage({ parkingItems: [item] })

    await deleteParkingItem(ROOM, 'pk1')

    expect(storage.parkingItems.toArray()).toHaveLength(0)
  })
})

describe('deleteUpdate', () => {
  beforeEach(() => vi.clearAllMocks())

  const mkUpdate = (
    id: string,
    pitchId: string,
    posted_at: string,
    needle_snapshot: { progress: number; zone: string }
  ) => makeMockItem({ id, pitchId, posted_at, needle_snapshot })

  it('deletes the latest update and reverts the pitch needle to the prior snapshot', async () => {
    const pitch = makeMockItem({
      id: 'p1',
      needle: { progress: 0.7, zone: 'on_track' },
    })
    const u1 = mkUpdate('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' })
    const u2 = mkUpdate('u2', 'p1', '2026-06-10T10:00:00Z', { progress: 0.7, zone: 'on_track' })
    const storage = setupStorage({ pitches: [pitch], updates: [u1, u2] })

    await deleteUpdate(ROOM, 'u2')

    expect(storage.updates.toArray()).toHaveLength(1)
    expect(storage.updates.toArray()[0].get('id')).toBe('u1')
    expect(pitch.get('needle')).toEqual({ progress: 0.3, zone: 'concerned' })
  })

  it('reverts the needle to null when deleting the only update', async () => {
    const pitch = makeMockItem({
      id: 'p1',
      needle: { progress: 0.3, zone: 'concerned' },
    })
    const u1 = mkUpdate('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' })
    const storage = setupStorage({ pitches: [pitch], updates: [u1] })

    await deleteUpdate(ROOM, 'u1')

    expect(storage.updates.toArray()).toHaveLength(0)
    expect(pitch.get('needle')).toBeNull()
  })

  it('refuses to delete an update that is not the latest for its pitch', async () => {
    const pitch = makeMockItem({ id: 'p1', needle: { progress: 0.7, zone: 'on_track' } })
    const u1 = mkUpdate('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' })
    const u2 = mkUpdate('u2', 'p1', '2026-06-10T10:00:00Z', { progress: 0.7, zone: 'on_track' })
    const storage = setupStorage({ pitches: [pitch], updates: [u1, u2] })

    await expect(deleteUpdate(ROOM, 'u1')).rejects.toThrow('latest update')
    expect(storage.updates.toArray()).toHaveLength(2)
    expect(pitch.get('needle')).toEqual({ progress: 0.7, zone: 'on_track' })
  })

  it('judges latest per-pitch, ignoring newer updates on other pitches', async () => {
    const p1 = makeMockItem({ id: 'p1', needle: { progress: 0.5, zone: 'some_risk' } })
    const u1 = mkUpdate('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.2, zone: 'concerned' })
    const u2 = mkUpdate('u2', 'p1', '2026-06-05T10:00:00Z', { progress: 0.5, zone: 'some_risk' })
    // Newer, but belongs to a different pitch — must not block deleting p1's latest.
    const o1 = mkUpdate('o1', 'p2', '2026-06-20T10:00:00Z', { progress: 0.9, zone: 'on_track' })
    const storage = setupStorage({ pitches: [p1], updates: [u1, u2, o1] })

    await deleteUpdate(ROOM, 'u2')

    expect(storage.updates.toArray().map((u) => u.get('id'))).toEqual(['u1', 'o1'])
    expect(p1.get('needle')).toEqual({ progress: 0.2, zone: 'concerned' })
  })

  it('throws when the update is not found', async () => {
    setupStorage()
    await expect(deleteUpdate(ROOM, 'nope')).rejects.toThrow('not found')
  })
})

describe('pushUpdate', () => {
  beforeEach(() => vi.clearAllMocks())

  const mkBuilt = (overrides: Partial<PitchUpdate> = {}): PitchUpdate => ({
    id: 'up_new',
    pitchId: 'p1',
    posted_at: '2026-06-10T10:00:00Z',
    posted_by: 'user_1',
    narrative: 'Shipped the gauge',
    needle_snapshot: { progress: 0.8, zone: 'on_track' },
    hill_snapshot: [],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 13, currentWeek: 3, totalWeeks: 6 },
    ...overrides,
  })

  it('appends the update and denormalizes the pitch needle', async () => {
    const pitch = makeMockItem({ id: 'p1', needle: { progress: 0.5, zone: 'some_risk' } })
    const storage = setupStorage({ pitches: [pitch], updates: [] })

    await pushUpdate(ROOM, mkBuilt())

    expect(storage.updates.toArray()).toHaveLength(1)
    expect(storage.updates.toArray()[0].get('id')).toBe('up_new')
    expect(pitch.get('needle')).toEqual({ progress: 0.8, zone: 'on_track' })
  })

  it('preserves a slack_attempted flag set on the built update', async () => {
    const pitch = makeMockItem({ id: 'p1', needle: null })
    const storage = setupStorage({ pitches: [pitch], updates: [] })

    await pushUpdate(ROOM, mkBuilt({ slack_attempted: true }))

    expect(storage.updates.toArray()[0].get('slack_attempted')).toBe(true)
  })
})

describe('markSlackDelivered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stamps slack_delivered_at on the matching update', async () => {
    const update = makeMockItem({ id: 'up_new', pitchId: 'p1', slack_attempted: true })
    setupStorage({ updates: [update] })

    await markSlackDelivered(ROOM, 'up_new', '2026-06-10T10:05:00Z')

    expect(update.get('slack_delivered_at')).toBe('2026-06-10T10:05:00Z')
  })
})

describe('upsertSquad', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a squad with an auto-assigned palette color when none given', async () => {
    const storage = setupStorage()

    const result = await upsertSquad(ROOM, { name: 'Platform' })

    expect(result.created).toBe(true)
    expect(result.id).toBeDefined()
    const squad = storage.squads.toArray()[0]
    expect(squad.name).toBe('Platform')
    expect(SCOPE_PALETTE).toContain(squad.color)
  })

  it('honors an explicit color on create', async () => {
    const storage = setupStorage()

    await upsertSquad(ROOM, { name: 'Growth', color: '#123456' })

    expect(storage.squads.toArray()[0].color).toBe('#123456')
  })

  it('renames and recolors an existing squad by id', async () => {
    const existing = makeMockItem({ id: 'sq1', name: 'Platform', color: '#000000' })
    const storage = setupStorage({ squads: [existing] })

    const result = await upsertSquad(ROOM, {
      id: 'sq1',
      name: 'Platform Team',
      color: '#abcdef',
    })

    expect(result.created).toBe(false)
    expect(result.id).toBe('sq1')
    expect(existing.get('name')).toBe('Platform Team')
    expect(existing.get('color')).toBe('#abcdef')
    expect(storage.squads.toArray()).toHaveLength(1)
  })

  it('throws when updating a squad with an unknown id', async () => {
    setupStorage()

    await expect(
      upsertSquad(ROOM, { id: 'nope', name: 'X' })
    ).rejects.toThrow(/not found/i)
  })
})

describe('upsertPitch squad assignment', () => {
  beforeEach(() => vi.clearAllMocks())

  const pitchParams = {
    title: 'Mission Control',
    stage: 'framing' as const,
    frame_problem: '',
    frame_outcome: '',
    timebox_start: '',
    timebox_end: '',
    emoji: '',
    notion_url: '',
  }

  it('auto-creates a squad by name and assigns it to a new pitch', async () => {
    const storage = setupStorage()

    await upsertPitch(ROOM, { ...pitchParams, squad: 'Platform' })

    const squads = storage.squads.toArray()
    expect(squads).toHaveLength(1)
    expect(squads[0].name).toBe('Platform')
    expect(SCOPE_PALETTE).toContain(squads[0].color)

    const pitch = storage.pitches.toArray()[0]
    expect(pitch.squadId).toBe(squads[0].id)
  })

  it('reuses an existing squad by case-insensitive name without duplicating', async () => {
    const existing = makeMockItem({ id: 'sq1', name: 'Platform', color: '#3e63dd' })
    const storage = setupStorage({ squads: [existing] })

    await upsertPitch(ROOM, { ...pitchParams, squad: '  platform ' })

    expect(storage.squads.toArray()).toHaveLength(1)
    expect(storage.pitches.toArray()[0].squadId).toBe('sq1')
  })

  it('clears the assignment when squad is an empty string', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'X', stage: 'framing', squadId: 'sq1' })
    setupStorage({
      pitches: [pitch],
      squads: [makeMockItem({ id: 'sq1', name: 'Platform', color: '#3e63dd' })],
    })

    await upsertPitch(ROOM, { ...pitchParams, id: 'p1', squad: '' })

    expect(pitch.get('squadId')).toBeUndefined()
  })

  it('leaves the existing assignment untouched when squad is omitted', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'X', stage: 'framing', squadId: 'sq1' })
    setupStorage({ pitches: [pitch] })

    await upsertPitch(ROOM, { ...pitchParams, id: 'p1' })

    expect(pitch.get('squadId')).toBe('sq1')
  })
})
