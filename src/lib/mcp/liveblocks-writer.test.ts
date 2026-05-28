import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    mutateStorage: vi.fn(),
    createRoom: vi.fn(),
    initializeStorageDocument: vi.fn(),
    deleteRoom: vi.fn(),
  },
}))

import { liveblocks } from '@/lib/liveblocks'
import {
  upsertPitch,
  upsertScope,
  upsertTask,
  upsertParkingItem,
  deletePitch,
  deleteScope,
  deleteTask,
  deleteParkingItem,
} from './liveblocks-writer'

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
}

function setupStorage(data: StorageData = {}) {
  const storage = {
    pitches: makeMockList(data.pitches ?? []),
    scopes: makeMockList(data.scopes ?? []),
    tasks: makeMockList(data.tasks ?? []),
    parkingItems: makeMockList(data.parkingItems ?? []),
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
