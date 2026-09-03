import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listCycleRooms,
  getCycleStorage,
  readCycleWindows,
  resolvePitch,
} from './liveblocks-reader'

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    getRooms: vi.fn(),
    getStorageDocument: vi.fn(),
  },
}))

import { liveblocks } from '@/lib/liveblocks'

const mockGetRooms = vi.mocked(liveblocks.getRooms)
const mockGetStorage = vi.mocked(liveblocks.getStorageDocument)

describe('listCycleRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries rooms with org prefix and returns summaries', async () => {
    mockGetRooms.mockResolvedValue({
      data: [
        {
          id: 'org_123:cycle:2026-q2-build',
          metadata: {
            title: 'Q2 Build',
            type: 'build',
            start_date: '2026-04-06',
            end_date: '2026-05-15',
          },
        },
        {
          id: 'org_123:cycle:cooldown-1',
          metadata: {
            title: 'Cooldown 1',
            type: 'cooldown',
            start_date: '2026-05-16',
            end_date: '2026-05-30',
            archived: 'true',
          },
        },
      ] as any,
      nextCursor: null,
      nextPage: null,
    } as any)

    const rooms = await listCycleRooms('org_123')

    expect(mockGetRooms).toHaveBeenCalledWith({
      query: 'roomId^"org_123:cycle:"',
    })
    // archived defaults to false when the metadata key is absent, and parses
    // === 'true' when present.
    expect(rooms).toEqual([
      { slug: '2026-q2-build', name: 'Q2 Build', type: 'build', start_date: '2026-04-06', end_date: '2026-05-15', archived: false },
      { slug: 'cooldown-1', name: 'Cooldown 1', type: 'cooldown', start_date: '2026-05-16', end_date: '2026-05-30', archived: true },
    ])
  })

  it('returns empty array when no rooms exist', async () => {
    mockGetRooms.mockResolvedValue({ data: [], nextCursor: null, nextPage: null } as any)
    const rooms = await listCycleRooms('org_empty')
    expect(rooms).toEqual([])
  })
})

describe('getCycleStorage', () => {
  it('fetches storage as JSON for the correct room ID', async () => {
    const fakeStorage = {
      cycle: { name: 'Q2', type: 'build', start_date: '', end_date: '' },
      pitches: [],
      scopes: [],
      tasks: [],
      updates: [],
      parkingItems: [],
    }
    mockGetStorage.mockResolvedValue(fakeStorage as any)

    const storage = await getCycleStorage('org_123', '2026-q2-build')

    expect(mockGetStorage).toHaveBeenCalledWith('org_123:cycle:2026-q2-build', 'json')
    expect(storage).toEqual(fakeStorage)
  })
})

describe('resolvePitch', () => {
  const storage = {
    cycle: { name: 'Q2', type: 'build' as const, start_date: '', end_date: '' },
    pitches: [
      { id: 'p1', title: 'Mission Control', stage: 'building' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '', emoji: '', notion_url: '' },
      { id: 'p2', title: 'Agentic Skills', stage: 'shaping' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '', emoji: '', notion_url: '' },
    ],
    scopes: [],
    tasks: [],
    updates: [],
    parkingItems: [],
  }

  it('resolves by slugified title', () => {
    expect(resolvePitch(storage, 'mission-control')).toEqual(storage.pitches[0])
  })

  it('resolves by ID', () => {
    expect(resolvePitch(storage, 'p2')).toEqual(storage.pitches[1])
  })

  it('returns undefined when not found', () => {
    expect(resolvePitch(storage, 'no-such-pitch')).toBeUndefined()
  })

  // ADR 0023: rooms written before the stage change still hold `framing`.
  // Nothing rewrites them, so the read surface normalizes on the way out.
  it('reads a stored framing stage as shaping', () => {
    const legacy = {
      ...storage,
      pitches: [{ ...storage.pitches[0], stage: 'framing' }],
    } as unknown as typeof storage
    expect(resolvePitch(legacy, 'p1')?.stage).toBe('shaping')
  })

  it('resolves a title with special characters via its cleaned slug', () => {
    const storageWithSpecialChars = {
      ...storage,
      pitches: [
        ...storage.pitches,
        { id: 'p3', title: 'Agentic Capabilities (Skills & Tools)', stage: 'building' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '', emoji: '', notion_url: '' },
      ],
    }
    expect(
      resolvePitch(storageWithSpecialChars, 'agentic-capabilities-skills-tools')
    ).toEqual(storageWithSpecialChars.pitches[2])
  })
})

describe('readCycleWindows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('names each cycle and keeps its dates, so freshness can count boundaries', async () => {
    mockGetRooms.mockResolvedValue({
      data: [
        {
          id: 'org_123:cycle:2026-q2',
          metadata: {
            title: 'Q2 Build',
            type: 'build',
            start_date: '2026-04-06',
            end_date: '2026-05-15',
          },
        },
        {
          id: 'org_123:cycle:cool-1',
          metadata: {
            title: 'Cooldown 1',
            type: 'cooldown',
            start_date: '2026-05-18',
            end_date: '2026-05-22',
          },
        },
      ] as any,
      nextCursor: null,
      nextPage: null,
    } as never)

    const windows = await readCycleWindows('org_123')

    expect(windows).toEqual([
      {
        slug: '2026-q2',
        title: 'Q2 Build',
        type: 'build',
        start_date: '2026-04-06',
        end_date: '2026-05-15',
      },
      {
        slug: 'cool-1',
        title: 'Cooldown 1',
        type: 'cooldown',
        start_date: '2026-05-18',
        end_date: '2026-05-22',
      },
    ])
  })

  // Losing the freshness channel beats losing the whole surface: the Product
  // Map still opens for a team whose cycle rooms cannot be read.
  it('returns nothing rather than throwing when the rooms cannot be read', async () => {
    mockGetRooms.mockRejectedValue(new Error('liveblocks is down'))
    await expect(readCycleWindows('org_123')).resolves.toEqual([])
  })
})
