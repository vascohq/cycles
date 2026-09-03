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
  openBatch,
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
  upsertArea,
  upsertFrame,
  attachReport,
  linkPointer,
  wakeFrame,
  resolveFrame,
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
    // @liveblocks/node's LiveList has NO toArray() — only map/filter/find/etc.
    // Modeling that here is what catches writers that wrongly call .toArray()
    // (the squad-upsert crash that .toArray() shipped to prod).
    map: <T>(fn: (item: MockItem) => T) => items.map(fn),
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
  // Product Map room storage (ADR 0021) — a different room, same mock shape.
  frames?: MockItem[]
  areas?: MockItem[]
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
    frames: makeMockList(data.frames ?? []),
    areas: makeMockList(data.areas ?? []),
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

  it('archives a cycle: mirrors archived=true to storage (boolean) and metadata ("true")', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE } })

    await updateCycle(ROOM, { archived: true })

    // Storage keeps a real boolean; metadata is string-valued.
    expect(storage.cycle.get('archived')).toBe(true)
    expect((mockUpdateRoom.mock.calls[0][1] as any).metadata).toEqual({ archived: 'true' })
    // Descriptive fields are untouched.
    expect(storage.cycle.get('name')).toBe('Q3 Build')
  })

  it('unarchives a cycle: mirrors archived=false to both surfaces', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE, archived: true } })

    await updateCycle(ROOM, { archived: false })

    expect(storage.cycle.get('archived')).toBe(false)
    expect((mockUpdateRoom.mock.calls[0][1] as any).metadata).toEqual({ archived: 'false' })
  })

  it('leaves archived untouched when the flag is omitted', async () => {
    mockGetRoom.mockResolvedValue({ id: ROOM } as any)
    const storage = setupStorage({ cycle: { ...EXISTING_CYCLE, archived: true } })

    await updateCycle(ROOM, { name: 'Renamed' })

    expect(storage.cycle.get('archived')).toBe(true)
    expect((mockUpdateRoom.mock.calls[0][1] as any).metadata).toEqual({ title: 'Renamed' })
  })
})

describe('upsertPitch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets the view when provided, and leaves it unchanged when omitted', async () => {
    const existing = makeMockItem({ id: 'p1', title: 'P', stage: 'building' })
    setupStorage({ pitches: [existing] })

    await upsertPitch(ROOM, { id: 'p1', title: 'P', stage: 'building', view: 'kanban' })
    expect(existing.get('view')).toBe('kanban')

    // Omitting view leaves it unchanged (partial update; ADR 0011).
    await upsertPitch(ROOM, { id: 'p1', title: 'P2', stage: 'building' })
    expect(existing.get('view')).toBe('kanban')
  })

  it('warns when view:"scope_map" is set on a pitch with no timebox (Kanban mode; ADR 0018)', async () => {
    // No timebox_start/timebox_end → Kanban MODE, so scope_map view can't render.
    const noTimebox = makeMockItem({
      id: 'p1',
      title: 'P',
      stage: 'building',
      timebox_start: '',
      timebox_end: '',
    })
    setupStorage({ pitches: [noTimebox] })

    const result = await upsertPitch(ROOM, { id: 'p1', title: 'P', stage: 'building', view: 'scope_map' })
    expect(noTimebox.get('view')).toBe('scope_map') // still stored
    expect(result.warning).toMatch(/timebox/i) // but caller is told it won't render

    // With a timebox, the view takes effect and there's no warning.
    const withTimebox = makeMockItem({
      id: 'p2',
      title: 'Q',
      stage: 'building',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
    })
    setupStorage({ pitches: [withTimebox] })
    const ok = await upsertPitch(ROOM, { id: 'p2', title: 'Q', stage: 'building', view: 'scope_map' })
    expect(ok.warning).toBeUndefined()

    // Setting the timebox in the SAME call clears the condition too.
    setupStorage({ pitches: [makeMockItem({ id: 'p3', title: 'R', stage: 'building', timebox_start: '', timebox_end: '' })] })
    const created = await upsertPitch(ROOM, {
      id: 'p3',
      title: 'R',
      stage: 'building',
      view: 'scope_map',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
    })
    expect(created.warning).toBeUndefined()
  })

  it('creates a new pitch when no id provided', async () => {
    const storage = setupStorage()

    const result = await upsertPitch(ROOM, {
      title: 'Mission Control',
      stage: 'shaping',
      frame_problem: 'No visibility',
      frame_outcome: 'Dashboard',
      timebox_start: '2026-04-06',
      timebox_end: '2026-05-15',
      emoji: '',
      notion_url: '',
    })

    expect(result.created).toBe(true)
    expect(result.id).toBeDefined()
    expect([...storage.pitches]).toHaveLength(1)
    const pitch = [...storage.pitches][0]
    expect(pitch.title).toBe('Mission Control')
    expect(pitch.needle).toBeNull()
  })

  it('updates an existing pitch when id is provided', async () => {
    const existing = makeMockItem({ id: 'p1', title: 'Old', stage: 'shaping' })
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
        stage: 'shaping',
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
    expect([...storage.scopes]).toHaveLength(1)
    const scope = [...storage.scopes][0]
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

  it('stores notes on create, and only when given', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'Mission Control' })
    const storage = setupStorage({ pitches: [pitch] })

    await upsertScope(ROOM, {
      pitchId: 'p1',
      title: 'With notes',
      tier: 'must',
      notes: 'Depends on the auth rewrite landing first.',
    })
    await upsertScope(ROOM, { pitchId: 'p1', title: 'Without notes', tier: 'must' })

    const [withNotes, withoutNotes] = [...storage.scopes]
    expect(withNotes.notes).toBe('Depends on the auth rewrite landing first.')
    // Absent — not '' — so "no notes" stays one state rather than two.
    expect('notes' in withoutNotes).toBe(false)
  })

  it('leaves notes untouched when omitted on update, and clears them on ""', async () => {
    const existing = makeMockItem({
      id: 's1',
      pitchId: 'p1',
      title: 'UI',
      tier: 'must',
      litmus_text: 'User sees dashboard',
      notes: 'Long agent findings…',
      hill_progress: 0.7,
    })
    setupStorage({ scopes: [existing] })

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must' })
    expect(existing.get('notes')).toBe('Long agent findings…')

    await upsertScope(ROOM, { id: 's1', pitchId: 'p1', title: 'UI', tier: 'must', notes: '' })
    expect(existing.get('notes')).toBe('')
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

    expect([...storage.scopes]).toHaveLength(1)
    expect(pitch.get('core_scope_id')).toBe(result.id)
  })
})

describe('upsertTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets status and keeps done in sync', async () => {
    const t = makeMockItem({ id: 't1', scopeId: 's1', title: 'T', done: false })
    setupStorage({ scopes: [makeMockItem({ id: 's1' })], tasks: [t] })

    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'T', status: 'done' })
    expect(t.get('status')).toBe('done')
    expect(t.get('done')).toBe(true)

    await upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'T', status: 'doing' })
    expect(t.get('status')).toBe('doing')
    expect(t.get('done')).toBe(false)
  })

  it('refuses a status outside the enum, on create and on update', async () => {
    const t = makeMockItem({ id: 't1', scopeId: 's1', title: 'T', done: false })
    const storage = setupStorage({ scopes: [makeMockItem({ id: 's1' })], tasks: [t] })

    // The `batch` tool forwards params un-validated, so the zod enum on the tool
    // is no guarantee here — an unknown status must never reach storage, where it
    // would break every column lookup on the board.
    await expect(
      upsertTask(ROOM, { id: 't1', scopeId: 's1', title: 'T', status: 'blocked' as any })
    ).rejects.toThrow(/Invalid status "blocked"/)
    expect(t.get('status')).toBeUndefined()

    await expect(
      upsertTask(ROOM, { scopeId: 's1', title: 'New', status: '' as any })
    ).rejects.toThrow(/Invalid status/)
    expect([...storage.tasks]).toHaveLength(1)
  })

  it('creates an unscoped (triage) task parented to a pitch', async () => {
    const storage = setupStorage({ pitches: [makeMockItem({ id: 'p1' })] })

    const result = await upsertTask(ROOM, { pitchId: 'p1', title: 'Triage me' })

    expect(result.created).toBe(true)
    const task = [...storage.tasks][0]
    expect(task.get('pitchId')).toBe('p1')
    expect(task.get('scopeId')).toBeUndefined()
    expect(task.get('title')).toBe('Triage me')
  })

  it('creates a new task under an existing scope', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })
    const storage = setupStorage({ scopes: [scope] })

    const result = await upsertTask(ROOM, {
      scopeId: 's1',
      title: 'Build gauge',
      done: false,
    })

    expect(result.created).toBe(true)
    expect([...storage.tasks]).toHaveLength(1)
    expect([...storage.tasks][0].title).toBe('Build gauge')
    expect([...storage.tasks][0].scopeId).toBe('s1')
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

    await upsertTask(ROOM, { id: 't1', title: 'Build the gauge' })

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

    await upsertTask(ROOM, { id: 't1', title: 'Build the gauge', done: true })

    expect(existing.get('title')).toBe('Build the gauge')
    expect(existing.get('done')).toBe(true)
    expect(existing.get('assigneeId')).toBe('u_simon')
  })

  it('assigns a task when a resolved assigneeId is passed', async () => {
    const existing = makeMockItem({ id: 't1', scopeId: 's1', title: 'Build gauge', done: false })
    setupStorage({ tasks: [existing] })
    await upsertTask(ROOM, { id: 't1', assigneeId: 'u_simon' })
    expect(existing.get('assigneeId')).toBe('u_simon')
  })

  it('unassigns by deleting the key when assigneeId is empty string', async () => {
    const existing = makeMockItem({ id: 't1', scopeId: 's1', title: 'Build gauge', done: false, assigneeId: 'u_simon' })
    setupStorage({ tasks: [existing] })
    await upsertTask(ROOM, { id: 't1', assigneeId: '' })
    expect(existing.get('assigneeId')).toBeUndefined()
  })

  it('sets assigneeId on create when provided', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })
    const storage = setupStorage({ scopes: [scope] })
    await upsertTask(ROOM, { scopeId: 's1', title: 'New', done: false, assigneeId: 'u_marie' })
    expect([...storage.tasks][0].get('assigneeId')).toBe('u_marie')
  })

  it('re-parents a triage card into a scope, keeping its pitch in step', async () => {
    // The board's "assign this card to a scope" move, over MCP (ADR 0018).
    const card = makeMockItem({ id: 't1', pitchId: 'p1', title: 'Triage me', done: false })
    setupStorage({
      pitches: [makeMockItem({ id: 'p1' })],
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })],
      tasks: [card],
    })

    await upsertTask(ROOM, { id: 't1', scopeId: 's1' })

    expect(card.get('scopeId')).toBe('s1')
    expect(card.get('pitchId')).toBe('p1')
    expect(card.get('title')).toBe('Triage me')
  })

  it('unscopes a card back to triage on its own pitch when scopeId is empty string', async () => {
    const card = makeMockItem({ id: 't1', scopeId: 's1', pitchId: 'p1', title: 'Scoped', done: false })
    setupStorage({
      pitches: [makeMockItem({ id: 'p1' })],
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })],
      tasks: [card],
    })

    await upsertTask(ROOM, { id: 't1', scopeId: '' })

    expect(card.get('scopeId')).toBeUndefined()
    expect(card.get('pitchId')).toBe('p1')
  })

  it('unscopes a legacy card with no pitchId by falling back to its scope pitch', async () => {
    const card = makeMockItem({ id: 't1', scopeId: 's1', title: 'Legacy', done: false })
    setupStorage({
      pitches: [makeMockItem({ id: 'p1' })],
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })],
      tasks: [card],
    })

    await upsertTask(ROOM, { id: 't1', scopeId: '' })

    expect(card.get('scopeId')).toBeUndefined()
    expect(card.get('pitchId')).toBe('p1')
  })

  it('re-parents a scoped card back to a pitch when pitchId is passed', async () => {
    const card = makeMockItem({ id: 't1', scopeId: 's1', pitchId: 'p1', title: 'Scoped', done: false })
    setupStorage({
      pitches: [makeMockItem({ id: 'p1' }), makeMockItem({ id: 'p2' })],
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })],
      tasks: [card],
    })

    await upsertTask(ROOM, { id: 't1', pitchId: 'p2' })

    expect(card.get('pitchId')).toBe('p2')
    expect(card.get('scopeId')).toBeUndefined()
  })

  it('validates the new parent before writing anything', async () => {
    // Half-applying a re-parent (title changed, parent not) is worse than
    // failing: the caller would read success into a card that never moved.
    const card = makeMockItem({ id: 't1', pitchId: 'p1', title: 'Triage me', done: false })
    setupStorage({ pitches: [makeMockItem({ id: 'p1' })], tasks: [card] })

    await expect(
      upsertTask(ROOM, { id: 't1', scopeId: 'ghost', title: 'Renamed' })
    ).rejects.toThrow('Scope not found: "ghost"')
    expect(card.get('title')).toBe('Triage me')
    expect(card.get('scopeId')).toBeUndefined()

    await expect(
      upsertTask(ROOM, { id: 't1', pitchId: 'ghost', title: 'Renamed' })
    ).rejects.toThrow('Pitch not found: "ghost"')
    expect(card.get('title')).toBe('Triage me')
  })

  it('refuses two parents on an update', async () => {
    const card = makeMockItem({ id: 't1', pitchId: 'p1', title: 'Triage me', done: false })
    setupStorage({
      pitches: [makeMockItem({ id: 'p1' })],
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })],
      tasks: [card],
    })

    await expect(
      upsertTask(ROOM, { id: 't1', scopeId: 's1', pitchId: 'p1' })
    ).rejects.toThrow(/at most one of "scopeId" or "pitchId"/)
    expect(card.get('scopeId')).toBeUndefined()
  })

  it('requires a title on create only', async () => {
    setupStorage({ scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })] })

    await expect(upsertTask(ROOM, { scopeId: 's1' })).rejects.toThrow(
      '"title" is required when creating a task'
    )
  })

  it('leaves the title unchanged when omitted on update', async () => {
    const card = makeMockItem({ id: 't1', scopeId: 's1', pitchId: 'p1', title: 'Keep me', done: false })
    setupStorage({ tasks: [card] })

    await upsertTask(ROOM, { id: 't1', status: 'doing' })

    expect(card.get('title')).toBe('Keep me')
    expect(card.get('status')).toBe('doing')
  })
})

describe('openBatch coalescing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies many task creates under a single mutateStorage call', async () => {
    const scope = makeMockItem({ id: 's1', pitchId: 'p1', title: 'UI' })
    const storage = setupStorage({ scopes: [scope] })

    await openBatch(ROOM, async (root) => {
      await upsertTask(ROOM, { scopeId: 's1', title: 'A' }, root)
      await upsertTask(ROOM, { scopeId: 's1', title: 'B' }, root)
      await upsertTask(ROOM, { scopeId: 's1', title: 'C' }, root)
    })

    expect([...storage.tasks].map((t) => t.get('title'))).toEqual(['A', 'B', 'C'])
    // The perf property: one load/flush for the whole batch, not one per task.
    expect(mockMutateStorage).toHaveBeenCalledTimes(1)
  })

  it('lets a later op see an earlier one within the same batch', async () => {
    // Create a scope then a task under it, in one batch — the task must see the
    // just-created scope without a separate round-trip.
    const storage = setupStorage({ pitches: [makeMockItem({ id: 'p1' })] })

    await openBatch(ROOM, async (root) => {
      await upsertScope(
        ROOM,
        { pitchId: 'p1', title: 'New scope', tier: 'must', litmus_text: '', hill_progress: 0 },
        root
      )
      const scopeId = [...storage.scopes][0].get('id') as string
      await upsertTask(ROOM, { scopeId, title: 'child' }, root)
    })

    expect([...storage.tasks]).toHaveLength(1)
    expect(mockMutateStorage).toHaveBeenCalledTimes(1)
  })
})

describe('moveTask', () => {
  beforeEach(() => vi.clearAllMocks())

  const seed = () =>
    setupStorage({
      // Two pitches share the one cycle-wide tasks list, so a move's anchor can
      // (wrongly) point at another board's card — 'z' is that card.
      scopes: [
        makeMockItem({ id: 's1', pitchId: 'p1' }),
        makeMockItem({ id: 's2', pitchId: 'p2' }),
      ],
      tasks: [
        makeMockItem({ id: 'a', scopeId: 's1', title: 'A', done: false }),
        makeMockItem({ id: 'b', scopeId: 's1', title: 'B', done: false }),
        makeMockItem({ id: 'c', scopeId: 's1', title: 'C', done: false }),
        makeMockItem({ id: 'z', scopeId: 's2', title: 'Z', done: false }),
      ],
    })
  const order = (s: ReturnType<typeof seed>) => s.tasks.map((t) => t.get('id'))
  const card = (s: ReturnType<typeof seed>, id: string) =>
    s.tasks.find((t) => t.get('id') === id)!

  it('moves a task after a later sibling', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'a', after: 'b' })
    expect(order(s)).toEqual(['b', 'a', 'c', 'z'])
  })

  it('moves a task after a later sibling (to the end)', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'a', after: 'c' })
    expect(order(s)).toEqual(['b', 'c', 'a', 'z'])
  })

  it('moves a task before an earlier sibling (to the front)', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'c', before: 'a' })
    expect(order(s)).toEqual(['c', 'a', 'b', 'z'])
  })

  it('changes a card column on its own, leaving the order alone', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'b', status: 'doing' })
    expect(order(s)).toEqual(['a', 'b', 'c', 'z'])
    expect(card(s, 'b').get('status')).toBe('doing')
    expect(card(s, 'b').get('done')).toBe(false)
  })

  it('keeps the legacy done flag in sync with the column', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'a', status: 'done' })
    expect(card(s, 'a').get('done')).toBe(true)
    await moveTask(ROOM, { id: 'a', status: 'todo' })
    expect(card(s, 'a').get('done')).toBe(false)
  })

  it('sets the column and the priority in one move', async () => {
    const s = seed()
    await moveTask(ROOM, { id: 'c', status: 'doing', before: 'a' })
    expect(order(s)).toEqual(['c', 'a', 'b', 'z'])
    expect(card(s, 'c').get('status')).toBe('doing')
  })

  it('throws when nothing to do is given', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'a' })).rejects.toThrow(/status/i)
  })

  it('throws when both before and after are given', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'a', before: 'b', after: 'c' })).rejects.toThrow(/at most one/i)
  })

  it('throws when the task or anchor is missing', async () => {
    seed()
    await expect(moveTask(ROOM, { id: 'ghost', after: 'b' })).rejects.toThrow(/Task not found/)
    await expect(moveTask(ROOM, { id: 'a', after: 'ghost' })).rejects.toThrow(/Anchor task not found/)
  })

  it('leaves the column unchanged when the anchor is missing', async () => {
    const s = seed()
    await expect(
      moveTask(ROOM, { id: 'a', status: 'doing', after: 'ghost' })
    ).rejects.toThrow(/Anchor task not found/)
    expect(card(s, 'a').get('status')).toBeUndefined()
    expect(order(s)).toEqual(['a', 'b', 'c', 'z'])
  })

  it('reports moved:false when the card already sat next to its anchor', async () => {
    const s = seed()
    // 'b' is already immediately after 'a' — a legitimate no-op, not an error.
    const result = await moveTask(ROOM, { id: 'b', after: 'a' })
    expect(result.moved).toBe(false)
    expect(order(s)).toEqual(['a', 'b', 'c', 'z'])

    expect((await moveTask(ROOM, { id: 'a', before: 'b' })).moved).toBe(false)
  })

  it('reports moved:true only when the position actually changed, echoing the column', async () => {
    seed()
    expect(await moveTask(ROOM, { id: 'a', after: 'c' })).toEqual({ moved: true })
    expect(await moveTask(ROOM, { id: 'a', status: 'doing' })).toEqual({
      moved: false,
      status: 'doing',
    })
  })

  it('rejects an anchor from another pitch instead of reporting a nonsense move', async () => {
    const s = seed()
    await expect(moveTask(ROOM, { id: 'a', after: 'z' })).rejects.toThrow(
      /different pitch/i
    )
    expect(order(s)).toEqual(['a', 'b', 'c', 'z'])
  })

  it('accepts an unscoped sibling on the same pitch as an anchor', async () => {
    const s = setupStorage({
      scopes: [makeMockItem({ id: 's1', pitchId: 'p1' })],
      tasks: [
        makeMockItem({ id: 'a', scopeId: 's1', title: 'A', done: false }),
        makeMockItem({ id: 'triage', pitchId: 'p1', title: 'Triage', done: false }),
      ],
    })
    await moveTask(ROOM, { id: 'triage', before: 'a' })
    expect(s.tasks.map((t) => t.get('id'))).toEqual(['triage', 'a'])
  })

  it('refuses a status outside the enum — batch bypasses the tool schema', async () => {
    const s = seed()
    await expect(moveTask(ROOM, { id: 'a', status: 'in_progress' as any })).rejects.toThrow(
      /Invalid status "in_progress"/
    )
    expect(card(s, 'a').get('status')).toBeUndefined()
    await expect(
      moveTask(ROOM, { id: 'a', status: 'doing', after: 'garbage' })
    ).rejects.toThrow(/Anchor task not found/)
  })

  it('runs against a batch root without opening its own mutateStorage', async () => {
    const s = seed()
    const root = { get: (key: string) => (s as any)[key] }
    await moveTask(ROOM, { id: 'a', after: 'c' }, root)
    expect(order(s)).toEqual(['b', 'c', 'a', 'z'])
    expect(mockMutateStorage).not.toHaveBeenCalled()
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
    expect([...storage.parkingItems]).toHaveLength(1)
    expect([...storage.parkingItems][0].text).toBe('Check accessibility')
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

    expect([...storage.pitches]).toHaveLength(0)
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

    expect([...storage.scopes]).toHaveLength(0)
    expect([...storage.tasks]).toHaveLength(1)
    expect([...storage.tasks][0].get('id')).toBe('t3')
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

    expect([...storage.tasks]).toHaveLength(0)
  })
})

describe('deleteParkingItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a parking item by id', async () => {
    const item = makeMockItem({ id: 'pk1', pitchId: 'p1' })
    const storage = setupStorage({ parkingItems: [item] })

    await deleteParkingItem(ROOM, 'pk1')

    expect([...storage.parkingItems]).toHaveLength(0)
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

    expect([...storage.updates]).toHaveLength(1)
    expect([...storage.updates][0].get('id')).toBe('u1')
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

    expect([...storage.updates]).toHaveLength(0)
    expect(pitch.get('needle')).toBeNull()
  })

  it('refuses to delete an update that is not the latest for its pitch', async () => {
    const pitch = makeMockItem({ id: 'p1', needle: { progress: 0.7, zone: 'on_track' } })
    const u1 = mkUpdate('u1', 'p1', '2026-06-03T10:00:00Z', { progress: 0.3, zone: 'concerned' })
    const u2 = mkUpdate('u2', 'p1', '2026-06-10T10:00:00Z', { progress: 0.7, zone: 'on_track' })
    const storage = setupStorage({ pitches: [pitch], updates: [u1, u2] })

    await expect(deleteUpdate(ROOM, 'u1')).rejects.toThrow('latest update')
    expect([...storage.updates]).toHaveLength(2)
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

    expect([...storage.updates].map((u) => u.get('id'))).toEqual(['u1', 'o1'])
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

    expect([...storage.updates]).toHaveLength(1)
    expect([...storage.updates][0].get('id')).toBe('up_new')
    expect(pitch.get('needle')).toEqual({ progress: 0.8, zone: 'on_track' })
  })

  it('preserves a slack_attempted flag set on the built update', async () => {
    const pitch = makeMockItem({ id: 'p1', needle: null })
    const storage = setupStorage({ pitches: [pitch], updates: [] })

    await pushUpdate(ROOM, mkBuilt({ slack_attempted: true }))

    expect([...storage.updates][0].get('slack_attempted')).toBe(true)
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
    const squad = [...storage.squads][0]
    expect(squad.name).toBe('Platform')
    expect(SCOPE_PALETTE).toContain(squad.color)
  })

  it('honors an explicit color on create', async () => {
    const storage = setupStorage()

    await upsertSquad(ROOM, { name: 'Growth', color: '#123456' })

    expect([...storage.squads][0].color).toBe('#123456')
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
    expect([...storage.squads]).toHaveLength(1)
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
    expect([...storage.squads]).toHaveLength(1)
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

    expect([...storage.squads]).toHaveLength(0)
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
    stage: 'shaping' as const,
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

    const squads = [...storage.squads]
    expect(squads).toHaveLength(1)
    expect(squads[0].name).toBe('Platform')
    expect(SCOPE_PALETTE).toContain(squads[0].color)

    const pitch = [...storage.pitches][0]
    expect(pitch.squadId).toBe(squads[0].id)
  })

  it('reuses an existing squad by case-insensitive name without duplicating', async () => {
    const existing = makeMockItem({ id: 'sq1', name: 'Platform', color: '#3e63dd' })
    const storage = setupStorage({ squads: [existing] })

    await upsertPitch(ROOM, { ...pitchParams, squad: '  platform ' })

    expect([...storage.squads]).toHaveLength(1)
    expect([...storage.pitches][0].squadId).toBe('sq1')
  })

  it('clears the assignment when squad is an empty string', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'X', stage: 'shaping', squadId: 'sq1' })
    setupStorage({
      pitches: [pitch],
      squads: [makeMockItem({ id: 'sq1', name: 'Platform', color: '#3e63dd' })],
    })

    await upsertPitch(ROOM, { ...pitchParams, id: 'p1', squad: '' })

    expect(pitch.get('squadId')).toBeUndefined()
  })

  it('leaves the existing assignment untouched when squad is omitted', async () => {
    const pitch = makeMockItem({ id: 'p1', title: 'X', stage: 'shaping', squadId: 'sq1' })
    setupStorage({ pitches: [pitch] })

    await upsertPitch(ROOM, { ...pitchParams, id: 'p1' })

    expect(pitch.get('squadId')).toBe('sq1')
  })

  // Rooms created before squads existed have no `squads` list in root storage;
  // the writer must lazily create one instead of crashing on `.toArray()`.
  it('backfills a missing squads list on an old room', async () => {
    const pitches = makeMockList([])
    const root: Record<string, unknown> = { pitches }
    const mock = {
      get: (k: string) => root[k],
      // Mirror Liveblocks attaching an inserted LiveList: store a working list
      // (the writer reads it back via root.get and calls .map/.push on it).
      set: (k: string, _v: unknown) => {
        root[k] = makeMockList([])
      },
    }
    mockMutateStorage.mockImplementation(async (_roomId, callback) => {
      await callback({ root: mock } as any)
    })

    await upsertPitch(ROOM, { ...pitchParams, squad: 'Platform' })

    const squads = [...(root.squads as ReturnType<typeof makeMockList>)]
    expect(squads).toHaveLength(1)
    expect(squads[0].name).toBe('Platform')
    expect([...pitches][0].squadId).toBe(squads[0].id)
  })
})

// ── Product Map ──

const MAP_ROOM = 'org_1:product-map'

function makeFrameItem(overrides: Record<string, unknown> = {}) {
  return makeMockItem({
    id: 'f1',
    kind: 'pain_point',
    type: 'bug',
    problem: 'Imports fail silently',
    appetite: '2 weeks',
    business_case: 'Three customers hit this last month',
    owner: 'user_9',
    reports: [{ capturer: 'user_9', source: 'internal', text: 'again', date: '2026-08-01' }],
    pointers: [{ url: 'https://example.test/1', label: 'Issue', kind: 'issue' }],
    last_woken: '2026-08-01',
    resolved: false,
    ...overrides,
  })
}

function makeAreaItem(overrides: Record<string, unknown> = {}) {
  return makeMockItem({
    id: 'a1',
    name: 'Integrations',
    x: 1,
    y: 0,
    owner: 'user_9',
    ...overrides,
  })
}

describe('upsertArea', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an area from a name alone', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    const result = await upsertArea(MAP_ROOM, { name: 'Billing' })

    expect(result.created).toBe(true)
    const area = storage.areas.find(() => true)!
    expect(area.get('name')).toBe('Billing')
    expect(area.get('parentAreaId')).toBeUndefined()
    expect(area.get('owner')).toBeUndefined()
  })

  // An agent cannot draw, so the app places the area. Position is a grid slot,
  // and the engine turns it into a shape.
  it('lands a new area on the next free grid slot', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({
      areas: [
        makeAreaItem({ id: 'a1', x: 0, y: 0 }),
        makeAreaItem({ id: 'a2', x: 1, y: 0 }),
        makeAreaItem({ id: 'a3', x: 2, y: 0 }),
      ],
    })

    await upsertArea(MAP_ROOM, { name: 'Billing' })

    const created = storage.areas.map((a: any) => a).at(-1)!
    expect(created.get('x')).toBe(0)
    expect(created.get('y')).toBe(1)
  })

  // Counting the areas would collide with an area somebody positioned by hand,
  // and two areas on one slot draw exactly on top of each other.
  it('skips a slot an area already sits on', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem({ id: 'a1', x: 0, y: 0 })] })

    await upsertArea(MAP_ROOM, { name: 'Billing' })

    const created = storage.areas.map((a: any) => a).at(-1)!
    expect(created.get('x')).toBe(1)
    expect(created.get('y')).toBe(0)
  })

  it('skips a hand-placed slot further along the grid', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem({ id: 'a1', x: 1, y: 0 })] })

    await upsertArea(MAP_ROOM, { name: 'Billing' })

    const created = storage.areas.map((a: any) => a).at(-1)!
    expect(created.get('x')).toBe(0)
    expect(created.get('y')).toBe(0)
  })

  it('refuses to blank the name of an existing area', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem()] })

    await expect(upsertArea(MAP_ROOM, { id: 'a1', name: '' })).rejects.toThrow(
      'cannot be blank'
    )
    expect(storage.areas.find(() => true)!.get('name')).toBe('Integrations')
  })

  it('honours a position the caller gave', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await upsertArea(MAP_ROOM, { name: 'Billing', x: 2, y: 3 })

    const area = storage.areas.find(() => true)!
    expect(area.get('x')).toBe(2)
    expect(area.get('y')).toBe(3)
  })

  it('creates a sub-area under its parent', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem()] })

    await upsertArea(MAP_ROOM, { name: 'HubSpot', parentAreaId: 'a1' })

    const created = storage.areas.map((a: any) => a).at(-1)!
    expect(created.get('parentAreaId')).toBe('a1')
  })

  it('creates the Product Map room on the first area', async () => {
    mockGetRoom.mockRejectedValue(new Error('Room not found'))
    setupStorage()

    await upsertArea(MAP_ROOM, { name: 'Billing' })

    expect(mockCreateRoom).toHaveBeenCalledWith(MAP_ROOM, expect.anything())
  })

  // ADR 0011: an omitted field is left unchanged.
  it('changes only the field the caller sent', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem()] })

    const result = await upsertArea(MAP_ROOM, { id: 'a1', name: 'Integrations & sync' })

    expect(result.created).toBe(false)
    const area = storage.areas.find(() => true)!
    expect(area.get('name')).toBe('Integrations & sync')
    expect(area.get('x')).toBe(1)
    expect(area.get('y')).toBe(0)
    expect(area.get('owner')).toBe('user_9')
  })

  it('moves an area by writing its position alone', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem()] })

    await upsertArea(MAP_ROOM, { id: 'a1', x: 0, y: 2 })

    const area = storage.areas.find(() => true)!
    expect(area.get('x')).toBe(0)
    expect(area.get('y')).toBe(2)
    expect(area.get('name')).toBe('Integrations')
  })

  it('clears an optional field when the caller passes an empty string', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ areas: [makeAreaItem({ parentAreaId: 'a0' })] })

    await upsertArea(MAP_ROOM, { id: 'a1', parentAreaId: '' })

    const area = storage.areas.find(() => true)!
    expect(area.get('parentAreaId')).toBeUndefined()
    expect(area.get('owner')).toBe('user_9')
  })

  it('refuses a create with no name', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await expect(upsertArea(MAP_ROOM, { owner: 'user_9' })).rejects.toThrow(
      'A new area needs a name'
    )
    expect(storage.areas.find(() => true)).toBeUndefined()
  })

  it('refuses to make an area its own parent', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ areas: [makeAreaItem()] })

    await expect(upsertArea(MAP_ROOM, { id: 'a1', parentAreaId: 'a1' })).rejects.toThrow(
      'cannot be its own parent'
    )
  })

  it('throws when the area id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ areas: [makeAreaItem()] })

    await expect(upsertArea(MAP_ROOM, { id: 'nope', name: 'x' })).rejects.toThrow(
      'Area not found: "nope"'
    )
  })
})

describe('upsertFrame', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a frame from a problem and a Type alone', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    const result = await upsertFrame(MAP_ROOM, {
      type: 'irritant',
      problem: 'The export button is three clicks deep',
    })

    expect(result.created).toBe(true)
    const frame = storage.frames.find(() => true)!
    expect(frame.get('problem')).toBe('The export button is three clicks deep')
    expect(frame.get('type')).toBe('irritant')
    // A frame with no appetite is rough. Sharpness is derived, never stored.
    expect(frame.get('appetite')).toBe('')
    expect(frame.get('business_case')).toBe('')
    expect(frame.get('reports')).toEqual([])
    expect(frame.get('pointers')).toEqual([])
    expect(frame.get('resolved')).toBe(false)
  })

  it('defaults the Kind to pain_point, so capture never has to pick a severity', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await upsertFrame(MAP_ROOM, { type: 'bug', problem: 'Slow' })

    expect(storage.frames.find(() => true)!.get('kind')).toBe('pain_point')
  })

  it('is born awake, with its clock started on the day it was captured', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await upsertFrame(MAP_ROOM, { type: 'bug', problem: 'Slow' })

    expect(storage.frames.find(() => true)!.get('last_woken')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('leaves a frame Unmapped when no area is given', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await upsertFrame(MAP_ROOM, { type: 'idea', problem: 'A digest email' })

    expect(storage.frames.find(() => true)!.get('areaId')).toBeUndefined()
  })

  // The Product Map room is org-scoped and may not exist yet (ADR 0021). An
  // agent must not have to create it by hand before its first capture.
  it('creates the Product Map room on the first capture', async () => {
    mockGetRoom.mockRejectedValue(new Error('Room not found'))
    setupStorage()

    await upsertFrame(MAP_ROOM, { type: 'bug', problem: 'Slow' })

    expect(mockCreateRoom).toHaveBeenCalledWith(MAP_ROOM, expect.anything())
    const [, doc] = mockInitStorage.mock.calls[0]
    expect((doc as any).data.frames).toEqual({ liveblocksType: 'LiveList', data: [] })
    expect((doc as any).data.areas).toEqual({ liveblocksType: 'LiveList', data: [] })
  })

  it('does not recreate a Product Map room that already exists', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage()

    await upsertFrame(MAP_ROOM, { type: 'bug', problem: 'Slow' })

    expect(mockCreateRoom).not.toHaveBeenCalled()
  })

  // ADR 0011: an omitted field is left unchanged. This is the guarantee that
  // lets a light touch on a frame never erase what somebody else wrote.
  it('changes only the field the caller sent', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    const result = await upsertFrame(MAP_ROOM, { id: 'f1', appetite: '6 weeks' })

    expect(result.created).toBe(false)
    const frame = storage.frames.find(() => true)!
    expect(frame.get('appetite')).toBe('6 weeks')
    expect(frame.get('problem')).toBe('Imports fail silently')
    expect(frame.get('kind')).toBe('pain_point')
    expect(frame.get('type')).toBe('bug')
    expect(frame.get('business_case')).toBe('Three customers hit this last month')
    expect(frame.get('owner')).toBe('user_9')
  })

  it('never touches the reports, the pointers or the wake clock', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await upsertFrame(MAP_ROOM, { id: 'f1', problem: 'Imports fail, loudly now' })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('reports')).toHaveLength(1)
    expect(frame.get('pointers')).toHaveLength(1)
    expect(frame.get('last_woken')).toBe('2026-08-01')
    expect(frame.get('resolved')).toBe(false)
  })

  it('clears an optional field when the caller passes an empty string', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ areaId: 'a1' })] })

    await upsertFrame(MAP_ROOM, { id: 'f1', areaId: '' })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('areaId')).toBeUndefined()
    expect(frame.get('owner')).toBe('user_9')
  })

  it('throws when the frame id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(upsertFrame(MAP_ROOM, { id: 'nope', problem: 'x' })).rejects.toThrow(
      'Frame not found: "nope"'
    )
  })
})

describe('upsertFrame validation', () => {
  beforeEach(() => vi.clearAllMocks())

  // The writer is the shared seam every path goes through, so the vocabularies
  // are enforced here and not only in the MCP tool schema.
  it('refuses a Type outside the vocabulary', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage()

    await expect(
      upsertFrame(MAP_ROOM, { type: 'feature' as never, problem: 'x' })
    ).rejects.toThrow('Invalid type')
    expect(mockCreateRoom).not.toHaveBeenCalled()
  })

  it('refuses a Kind outside the vocabulary', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage()

    await expect(
      upsertFrame(MAP_ROOM, { id: 'f1', kind: 'severe' as never })
    ).rejects.toThrow('Invalid kind')
  })

  // Type selects the playbook, so there is no unknown Type (ADR 0025).
  it('refuses a create with no Type', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage()

    await expect(upsertFrame(MAP_ROOM, { problem: 'Something hurts' })).rejects.toThrow(
      'A new frame needs a type'
    )
    expect(storage.frames.find(() => true)).toBeUndefined()
  })

  it('lets an update omit the Type, because the frame already has one', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await upsertFrame(MAP_ROOM, { id: 'f1', appetite: '6 weeks' })

    expect(storage.frames.find(() => true)!.get('type')).toBe('bug')
  })
})

describe('attachReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds the report and reports the new count', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    const result = await attachReport(MAP_ROOM, {
      frameId: 'f1',
      capturer: 'user_2',
      source: 'customer',
      customer: 'Acme',
      link: 'https://example.test/call',
      text: 'Their nightly import dropped 400 rows',
      date: '2026-09-02',
    })

    expect(result).toEqual({ frameId: 'f1', reportCount: 2 })
    const reports = storage.frames.find(() => true)!.get('reports') as any[]
    expect(reports).toHaveLength(2)
    expect(reports[1]).toEqual({
      capturer: 'user_2',
      source: 'customer',
      customer: 'Acme',
      link: 'https://example.test/call',
      text: 'Their nightly import dropped 400 rows',
      date: '2026-09-02',
    })
  })

  // The core ADR 0011 guarantee for this tool: a report is additive and nothing
  // else on the frame is rewritten.
  it('leaves the problem, the appetite, the pointers and the owner untouched', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await attachReport(MAP_ROOM, { frameId: 'f1', capturer: 'user_2', text: 'again' })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('problem')).toBe('Imports fail silently')
    expect(frame.get('appetite')).toBe('2 weeks')
    expect(frame.get('business_case')).toBe('Three customers hit this last month')
    expect(frame.get('owner')).toBe('user_9')
    expect(frame.get('pointers')).toHaveLength(1)
    expect(frame.get('kind')).toBe('pain_point')
    expect(frame.get('type')).toBe('bug')
    expect(frame.get('resolved')).toBe(false)
  })

  // A new report is one of the three things that wake a frame (ADR 0024).
  it('wakes the frame', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ last_woken: '2026-01-01' })] })

    await attachReport(MAP_ROOM, {
      frameId: 'f1',
      capturer: 'user_2',
      text: 'again',
      date: '2026-09-02',
    })

    expect(storage.frames.find(() => true)!.get('last_woken')).toBe('2026-09-02')
  })

  // Internal is the quieter claim, so a report only counts under the customer
  // lens when somebody said so.
  it('defaults the source to internal', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ reports: [] })] })

    await attachReport(MAP_ROOM, { frameId: 'f1', capturer: 'user_2', text: 'again' })

    const reports = storage.frames.find(() => true)!.get('reports') as any[]
    expect(reports[0].source).toBe('internal')
  })

  it('omits the customer label and the link rather than storing blanks', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ reports: [] })] })

    await attachReport(MAP_ROOM, {
      frameId: 'f1',
      capturer: 'user_2',
      text: 'again',
      customer: '   ',
      link: '',
    })

    const reports = storage.frames.find(() => true)!.get('reports') as any[]
    expect(reports[0]).not.toHaveProperty('customer')
    expect(reports[0]).not.toHaveProperty('link')
  })

  it('refuses a report with no text', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      attachReport(MAP_ROOM, { frameId: 'f1', capturer: 'user_2', text: '  ' })
    ).rejects.toThrow('A report needs text')
  })

  it('refuses a source outside the vocabulary', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      attachReport(MAP_ROOM, {
        frameId: 'f1',
        capturer: 'user_2',
        text: 'again',
        source: 'slack' as never,
      })
    ).rejects.toThrow('Invalid source')
  })

  it('throws when the frame id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      attachReport(MAP_ROOM, { frameId: 'nope', capturer: 'user_2', text: 'again' })
    ).rejects.toThrow('Frame not found: "nope"')
  })
})

describe('linkPointer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('attaches the pointer and reports the new count', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    const result = await linkPointer(MAP_ROOM, {
      frameId: 'f1',
      url: 'https://github.test/org/repo/pull/9',
      kind: 'pull_request',
      label: 'The fix',
    })

    expect(result).toEqual({ frameId: 'f1', pointerCount: 2 })
    const pointers = storage.frames.find(() => true)!.get('pointers') as any[]
    expect(pointers[1]).toEqual({
      url: 'https://github.test/org/repo/pull/9',
      label: 'The fix',
      kind: 'pull_request',
    })
  })

  // The core ADR 0011 guarantee for this tool.
  it('leaves every other field untouched, and does not wake the frame', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await linkPointer(MAP_ROOM, {
      frameId: 'f1',
      url: 'https://notion.test/doc',
      kind: 'shaped_doc',
    })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('problem')).toBe('Imports fail silently')
    expect(frame.get('appetite')).toBe('2 weeks')
    expect(frame.get('business_case')).toBe('Three customers hit this last month')
    expect(frame.get('owner')).toBe('user_9')
    expect(frame.get('reports')).toHaveLength(1)
    // Filing a link is not one of the three things that wake a frame (ADR 0024).
    expect(frame.get('last_woken')).toBe('2026-08-01')
  })

  it('falls back to the kind for a label, so there is always something to click', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ pointers: [] })] })

    await linkPointer(MAP_ROOM, {
      frameId: 'f1',
      url: 'https://github.test/org/repo/issues/1',
      kind: 'wayfinder',
    })

    const pointers = storage.frames.find(() => true)!.get('pointers') as any[]
    expect(pointers[0].label).toBe('Wayfinder map')
  })

  // A shape points at its frame, not the reverse (ADR 0022), so the vocabulary
  // has no kind for one and the writer refuses it.
  it('refuses a pointer kind outside the vocabulary, a Shape included', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      linkPointer(MAP_ROOM, { frameId: 'f1', url: 'https://x.test', kind: 'shape' as never })
    ).rejects.toThrow('Invalid pointer kind')
  })

  it('refuses a pointer with no url', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      linkPointer(MAP_ROOM, { frameId: 'f1', url: '  ', kind: 'issue' })
    ).rejects.toThrow('A pointer needs a url')
  })

  it('throws when the frame id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(
      linkPointer(MAP_ROOM, { frameId: 'nope', url: 'https://x.test', kind: 'issue' })
    ).rejects.toThrow('Frame not found: "nope"')
  })
})

describe('wakeFrame', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resets the freshness clock and reports the date', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ last_woken: '2026-01-01' })] })

    const result = await wakeFrame(MAP_ROOM, { frameId: 'f1', date: '2026-09-02' })

    expect(result).toEqual({ frameId: 'f1', wokenOn: '2026-09-02' })
    expect(storage.frames.find(() => true)!.get('last_woken')).toBe('2026-09-02')
  })

  // The guarantee that matters most for this tool: a wake must NEVER erase a
  // frame (ADR 0011, ADR 0024).
  it('leaves the problem, the appetite, the reports, the pointers and the owner alone', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await wakeFrame(MAP_ROOM, { frameId: 'f1', date: '2026-09-02' })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('problem')).toBe('Imports fail silently')
    expect(frame.get('appetite')).toBe('2 weeks')
    expect(frame.get('business_case')).toBe('Three customers hit this last month')
    expect(frame.get('owner')).toBe('user_9')
    expect(frame.get('kind')).toBe('pain_point')
    expect(frame.get('type')).toBe('bug')
    expect(frame.get('reports')).toHaveLength(1)
    expect(frame.get('pointers')).toHaveLength(1)
    expect(frame.get('resolved')).toBe(false)
  })

  it('throws when the frame id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(wakeFrame(MAP_ROOM, { frameId: 'nope' })).rejects.toThrow(
      'Frame not found: "nope"'
    )
  })
})

describe('upsertPitch frame pointer', () => {
  beforeEach(() => vi.clearAllMocks())

  const ROOM = 'org_1:cycle:2026-q3'

  it('stores the frame the shape attacks', async () => {
    const storage = setupStorage()

    await upsertPitch(ROOM, {
      title: 'Fix silent imports',
      stage: 'shaping',
      frame_problem: 'Imports fail silently',
      frameId: 'f1',
    })

    const pitch = storage.pitches.find(() => true)!
    expect(pitch.get('frameId')).toBe('f1')
    // The Frame as bet: a copy taken now, which the map can never rewrite.
    expect(pitch.get('frame_problem')).toBe('Imports fail silently')
  })

  it('leaves a shape created with no frame without one', async () => {
    const storage = setupStorage()

    await upsertPitch(ROOM, { title: 'Cooldown chores', stage: 'building' })

    expect(storage.pitches.find(() => true)!.get('frameId')).toBeUndefined()
  })

  it('leaves the frame pointer alone when the caller omits it (ADR 0011)', async () => {
    const storage = setupStorage({
      pitches: [makeMockItem({ id: 'p1', title: 'Old', stage: 'building', frameId: 'f1' })],
    })

    await upsertPitch(ROOM, { id: 'p1', title: 'Renamed', stage: 'building' })

    expect(storage.pitches.find(() => true)!.get('frameId')).toBe('f1')
  })

  it('clears the frame pointer on an empty string', async () => {
    const storage = setupStorage({
      pitches: [makeMockItem({ id: 'p1', title: 'Old', stage: 'building', frameId: 'f1' })],
    })

    await upsertPitch(ROOM, { id: 'p1', title: 'Old', stage: 'building', frameId: '' })

    expect(storage.pitches.find(() => true)!.get('frameId')).toBeUndefined()
  })
})

describe('resolveFrame', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets the resolved flag', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    const result = await resolveFrame(MAP_ROOM, { frameId: 'f1' })

    expect(result).toEqual({ frameId: 'f1', resolved: true })
    expect(storage.frames.find(() => true)!.get('resolved')).toBe(true)
  })

  it('changes nothing else, because nothing is ever deleted', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem()] })

    await resolveFrame(MAP_ROOM, { frameId: 'f1' })

    const frame = storage.frames.find(() => true)!
    expect(frame.get('problem')).toBe('Imports fail silently')
    expect(frame.get('appetite')).toBe('2 weeks')
    expect(frame.get('business_case')).toBe('Three customers hit this last month')
    expect(frame.get('owner')).toBe('user_9')
    expect(frame.get('reports')).toHaveLength(1)
    expect(frame.get('pointers')).toHaveLength(1)
    expect(frame.get('last_woken')).toBe('2026-08-01')
  })

  it('puts a frame back on the map when the caller passes false', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    const storage = setupStorage({ frames: [makeFrameItem({ resolved: true })] })

    await resolveFrame(MAP_ROOM, { frameId: 'f1', resolved: false })

    expect(storage.frames.find(() => true)!.get('resolved')).toBe(false)
  })

  it('throws when the frame id is unknown', async () => {
    mockGetRoom.mockResolvedValue({} as never)
    setupStorage({ frames: [makeFrameItem()] })

    await expect(resolveFrame(MAP_ROOM, { frameId: 'nope' })).rejects.toThrow(
      'Frame not found: "nope"'
    )
  })
})
