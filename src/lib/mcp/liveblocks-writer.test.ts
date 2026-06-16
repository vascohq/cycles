import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    mutateStorage: vi.fn(),
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    initializeStorageDocument: vi.fn(),
    updateRoom: vi.fn(),
    deleteRoom: vi.fn(),
  },
}))

import { liveblocks } from '@/lib/liveblocks'
import {
  createCycle,
  updateCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
  moveTask,
  upsertParkingItem,
  deletePitch,
  deleteScope,
  deleteTask,
  deleteParkingItem,
  deleteUpdate,
  pushUpdate,
  markSlackDelivered,
  upsertSquad,
  deleteSquad,
} from './liveblocks-writer'
import { SCOPE_PALETTE } from '@/lib/color-engine'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

const mockGetRoom = vi.mocked(liveblocks.getRoom)
const mockCreateRoom = vi.mocked(liveblocks.createRoom)
const mockInitStorage = vi.mocked(liveblocks.initializeStorageDocument)

const mockMutateStorage = vi.mocked(liveblocks.mutateStorage)
const mockUpdateRoom = vi.mocked(liveblocks.updateRoom)

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
      // Mirror Liveblocks: set(key, undefined) does NOT remove the key — use
      // delete() to clear. Modeling this catches "clear by set(undefined)" bugs.
      if (value === undefined) return
      store[key] = value
    },
    delete: (key: string) => {
      delete store[key]
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
    // Mirror Liveblocks LiveList.move: remove at `from`, reinsert at `to`.
    move: (from: number, to: number) => {
      const [it] = items.splice(from, 1)
      items.splice(to, 0, it)
    },
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
  cycle?: Record<string, unknown>
}

function setupStorage(data: StorageData = {}) {
  const storage = {
    pitches: makeMockList(data.pitches ?? []),
    scopes: makeMockList(data.scopes ?? []),
    tasks: makeMockList(data.tasks ?? []),
    parkingItems: makeMockList(data.parkingItems ?? []),
    updates: makeMockList(data.updates ?? []),
    squads: makeMockList(data.squads ?? []),
    cycle: makeMockItem(data.cycle ?? {}),
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

describe('updateCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  const EXISTING_CYCLE = {
    name: 'Q3 Build',
    type: 'build',
    start_date: '2026-07-06',
    end_date: '2026-08-14',
  }

  it('updates only the passed field on storage and returns the resulting cycle', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE } })

    const result = await updateCycle(ROOM, { start_date: '2026-07-13' })

    expect(storage.cycle.get('start_date')).toBe('2026-07-13')
    // Untouched fields stay put.
    expect(storage.cycle.get('name')).toBe('Q3 Build')
    expect(storage.cycle.get('end_date')).toBe('2026-08-14')
    expect(result).toEqual({
      updated: true,
      cycle: {
        name: 'Q3 Build',
        type: 'build',
        start_date: '2026-07-13',
        end_date: '2026-08-14',
      },
    })
  })

  it('mirrors the changed subset into room metadata, mapping name to title', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    setupStorage({ cycle: { ...EXISTING_CYCLE } })

    await updateCycle(ROOM, { name: 'Q3 Crunch', start_date: '2026-07-13' })

    expect(mockUpdateRoom).toHaveBeenCalledTimes(1)
    const [roomId, opts] = mockUpdateRoom.mock.calls[0]
    expect(roomId).toBe(ROOM)
    // Only the changed fields are sent; `name` becomes metadata `title`.
    expect((opts as any).metadata).toEqual({
      title: 'Q3 Crunch',
      start_date: '2026-07-13',
    })
  })

  it('clears a field in both storage and metadata when passed an empty string', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE } })

    const result = await updateCycle(ROOM, { end_date: '' })

    expect(storage.cycle.get('end_date')).toBe('')
    expect(result.cycle.end_date).toBe('')
    expect((mockUpdateRoom.mock.calls[0][1] as any).metadata).toEqual({ end_date: '' })
  })

  it('leaves storage untouched and writes no metadata when no fields are passed', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE } })

    const result = await updateCycle(ROOM, {})

    expect(mockUpdateRoom).not.toHaveBeenCalled()
    expect(storage.cycle.get('name')).toBe('Q3 Build')
    expect(result.cycle).toEqual(EXISTING_CYCLE)
  })

  it('throws and writes nothing when the cycle does not exist', async () => {
    mockGetRoom.mockRejectedValue(new Error('Room not found'))
    setupStorage({ cycle: { ...EXISTING_CYCLE } })

    await expect(updateCycle(ROOM, { name: 'Nope' })).rejects.toThrow(/not found/i)
    expect(mockMutateStorage).not.toHaveBeenCalled()
    expect(mockUpdateRoom).not.toHaveBeenCalled()
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

  it('leaves timebox, frame, emoji and notion untouched when omitted on update', async () => {
    // Regression: upsert_pitch is a partial update. Omitting a field (e.g. when
    // assigning a squad) must NOT wipe it — previously these clobbered to ''.
    const existing = makeMockItem({
      id: 'p1',
      title: 'Mission Control',
      stage: 'building',
      frame_problem: 'No visibility',
      frame_outcome: 'Dashboard',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
      emoji: '🚀',
      notion_url: 'https://notion.so/x',
    })
    setupStorage({ pitches: [existing] })

    await upsertPitch(ROOM, { id: 'p1', title: 'Mission Control', stage: 'done' })

    expect(existing.get('stage')).toBe('done')
    expect(existing.get('timebox_start')).toBe('2026-04-06')
    expect(existing.get('timebox_end')).toBe('2026-05-15')
    expect(existing.get('frame_problem')).toBe('No visibility')
    expect(existing.get('frame_outcome')).toBe('Dashboard')
    expect(existing.get('emoji')).toBe('🚀')
    expect(existing.get('notion_url')).toBe('https://notion.so/x')
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

  it('leaves litmus_text and hill_progress untouched when omitted on update', async () => {
    // Regression: a partial update (e.g. renaming a scope) must not wipe litmus
    // or reset hill_progress to 0.
    const existing = makeMockItem({
      id: 's1',
      pitchId: 'p1',
      title: 'UI',
      tier: 'must',
      litmus_text: 'User sees dashboard',
      hill_progress: 0.7,
    })
    setupStorage({ scopes: [existing] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI Layer', tier: 'should' })

    expect(existing.get('title')).toBe('UI Layer')
    expect(existing.get('tier')).toBe('should')
    expect(existing.get('litmus_text')).toBe('User sees dashboard')
    expect(existing.get('hill_progress')).toBe(0.7)
  })
})

describe('upsertScope core flag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('core:true sets the scope as the pitch core, stealing from any current core', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'MC', core_scope_id: 's0' })
    const s1 = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI', tier: 'must' })
    setupStorage({ pitches: [pitch], scopes: [s1] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', core: true })

    expect(pitch.get('core_scope_id')).toBe('s1')
  })

  it('core:false clears the pitch core only when this scope is currently core', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'MC', core_scope_id: 's1' })
    const s1 = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI', tier: 'must' })
    setupStorage({ pitches: [pitch], scopes: [s1] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', core: false })

    expect(pitch.get('core_scope_id')).toBeUndefined()
  })

  it('core:false is a no-op when another scope is the core', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'MC', core_scope_id: 's2' })
    const s1 = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI', tier: 'must' })
    setupStorage({ pitches: [pitch], scopes: [s1] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', core: false })

    expect(pitch.get('core_scope_id')).toBe('s2')
  })

  it('leaves the pitch core untouched when core is omitted', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'MC', core_scope_id: 's2' })
    const s1 = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI', tier: 'must' })
    setupStorage({ pitches: [pitch], scopes: [s1] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI Layer', tier: 'must' })

    expect(pitch.get('core_scope_id')).toBe('s2')
  })

  it('core:true on create flags the freshly created scope', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'MC' })
    const storage = setupStorage({ pitches: [pitch] })

    const result = await upsertScope(ROOM, { pitchId: 'p1', title: 'New', tier: 'must', core: true })

    expect(storage.scopes.toArray()).toHaveLength(1)
    expect(pitch.get('core_scope_id')).toBe(result.id)
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

  it('leaves done untouched when omitted on update', async () => {
    // Regression: renaming a task must not un-complete it.
    const existing = makeMockItem({ id: 't1', scopeId: 's1', title: 'Build gauge', done: true })
    setupStorage({ tasks: [existing] })

    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'Build the gauge' })

    expect(existing.get('title')).toBe('Build the gauge')
    expect(existing.get('done')).toBe(true)
  })

  it('leaves an existing assigneeId untouched on a title/done update', async () => {
    // v1 MCP is reader-only for assignment: a title/done write must never
    // clobber who a task is assigned to (see ADR 0017 / issue #162).
    const existing = makeMockItem({
      id: 't1', scopeId: 's1', title: 'Build gauge', done: false, assigneeId: 'u_simon',
    })
    setupStorage({ tasks: [existing] })

    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'Build the gauge', done: true })

    expect(existing.get('title')).toBe('Build the gauge')
    expect(existing.get('done')).toBe(true)
    expect(existing.get('assigneeId')).toBe('u_simon')
  })

  it('assigns a task when a resolved assigneeId is passed', async () => {
    const existing = makeMockItem({ id: 't1', scopeId: 's1', title: 'Build gauge', done: false })
    setupStorage({ tasks: [existing] })
    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'Build gauge', assigneeId: 'u_simon' })
    expect(existing.get('assigneeId')).toBe('u_simon')
  })

  it('unassigns by deleting the key when assigneeId is empty string', async () => {
    const existing = makeMockItem({ id: 't1', scopeId: 's1', title: 'Build gauge', done: false, assigneeId: 'u_simon' })
    setupStorage({ tasks: [existing] })
    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'Build gauge', assigneeId: '' })
    expect(existing.get('assigneeId')).toBeUndefined()
  })

  it('sets assigneeId on create when provided', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })
    const storage = setupStorage({ scopes: [scope] })
    await upsertTask(ROOM, { scopeId: 's1', title: 'New', done: false, assigneeId: 'u_marie' })
    expect(storage.tasks.toArray()[0].get('assigneeId')).toBe('u_marie')
  })
})

describe('moveTask', () => {
  beforeEach(() => vi.clearAllMocks())

  const seed = () =>
    setupStorage({
      tasks: [
        makeMockItem({ id: 'a', scopeId: 's1', title: 'A', done: false }),
        makeMockItem({ id: 'b', scopeId: 's1', title: 'B', done: false }),
        makeMockItem({ id: 'c', scopeId: 's1', title: 'C', done: false }),
      ],
    })
  const order = (s: ReturnType<typeof seed>) => s.tasks.toArray().map((t) => t.get('id'))

  it('moves a task after a later sibling', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'a', after: 'b' })
    expect(order(s)).toEqual(['b', 'a', 'c'])
  })

  it('moves a task after a later sibling (to the end)', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'a', after: 'c' })
    expect(order(s)).toEqual(['b', 'c', 'a'])
  })

  it('moves a task before an earlier sibling (to the front)', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'c', before: 'a' })
    expect(order(s)).toEqual(['c', 'a', 'b'])
  })

  it('throws when neither before nor after is given', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'a' })).rejects.toThrow(/exactly one/i)
  })

  it('throws when both before and after are given', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'a', before: 'b', after: 'c' })).rejects.toThrow(/exactly one/i)
  })

  it('throws when the task or anchor is missing', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'ghost', after: 'b' })).rejects.toThrow(/Task not found/)
    await expect(moveTask(ROOM, { id: 'a', after: 'ghost' })).rejects.toThrow(/Anchor task not found/)
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

  it('leaves resolved untouched when omitted on update', async () => {
    // Regression: editing the text must not un-resolve the item.
    const existing = makeMockItem({ id: 'pk1', pitchId: 'p1', text: 'Old', resolved: true })
    setupStorage({ parkingItems: [existing] })

    await upsertParkingItem(ROOM, { id: 'pk1', pitchId: 'p1', text: 'New text' })

    expect(existing.get('text')).toBe('New text')
    expect(existing.get('resolved')).toBe(true)
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

  it('clears the pitch core_scope_id when the deleted scope was the core', async () => {
    const pitch = makeMockItem({ id: 'p1', core_scope_id: 's1' })
    const scope = makeMockItem({ id: 's1', pitchId: 'p1' })
    setupStorage({ pitches: [pitch], scopes: [scope] })

    await deleteScope(ROOM, 's1')

    expect(pitch.get('core_scope_id')).toBeUndefined()
  })

  it('leaves the pitch core_scope_id when deleting a non-core scope', async () => {
    const pitch = makeMockItem({ id: 'p1', core_scope_id: 's2' })
    const scope = makeMockItem({ id: 's1', pitchId: 'p1' })
    setupStorage({ pitches: [pitch], scopes: [scope] })

    await deleteScope(ROOM, 's1')

    expect(pitch.get('core_scope_id')).toBe('s2')
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

  it('rejects renaming a squad to a name another squad already uses', async () => {
    const a = makeMockItem({ id: 'sq1', name: 'Platform', color: '#000000' })
    const b = makeMockItem({ id: 'sq2', name: 'Growth', color: '#111111' })
    setupStorage({ squads: [a, b] })

    await expect(
      upsertSquad(ROOM, { id: 'sq1', name: 'growth' })
    ).rejects.toThrow(/already/i)
    // The colliding rename must not have mutated the squad.
    expect(a.get('name')).toBe('Platform')
  })

  it('allows renaming a squad to a case/whitespace variant of its own name', async () => {
    const a = makeMockItem({ id: 'sq1', name: 'Platform', color: '#000000' })
    setupStorage({ squads: [a] })

    await upsertSquad(ROOM, { id: 'sq1', name: '  platform  ' })

    expect(a.get('name')).toBe('  platform  ')
  })

  it('rejects creating a squad whose name a squad already uses', async () => {
    const a = makeMockItem({ id: 'sq1', name: 'Platform', color: '#000000' })
    const storage = setupStorage({ squads: [a] })

    await expect(upsertSquad(ROOM, { name: 'platform' })).rejects.toThrow(
      /already/i
    )
    expect(storage.squads.toArray()).toHaveLength(1)
  })
})

describe('deleteSquad', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes the squad and unassigns only its own pitches', async () => {
    const squad = makeMockItem({ id: 'sq1', name: 'Platform', color: '#3e63dd' })
    const p1 = makeMockItem({ id: 'p1', title: 'A', squadId: 'sq1' })
    const p2 = makeMockItem({ id: 'p2', title: 'B', squadId: 'sq2' })
    const storage = setupStorage({ squads: [squad], pitches: [p1, p2] })

    await deleteSquad(ROOM, 'sq1')

    expect(storage.squads.toArray()).toHaveLength(0)
    expect(p1.get('squadId')).toBeUndefined()
    expect(p2.get('squadId')).toBe('sq2')
  })

  it('throws when the squad id is unknown', async () => {
    setupStorage({ squads: [] })

    await expect(deleteSquad(ROOM, 'nope')).rejects.toThrow(/not found/i)
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
