import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'

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
    expect(rooms).toEqual([
      { slug: '2026-q2-build', name: 'Q2 Build', type: 'build', start_date: '2026-04-06', end_date: '2026-05-15' },
      { slug: 'cooldown-1', name: 'Cooldown 1', type: 'cooldown', start_date: '2026-05-16', end_date: '2026-05-30' },
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
      cycle: { name: 'Q2', type: 'build', start_date: '', end_date: '', slack_channel: '' },
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
    cycle: { name: 'Q2', type: 'build' as const, start_date: '', end_date: '', slack_channel: '' },
    pitches: [
      { id: 'p1', title: 'Mission Control', stage: 'building' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '' },
      { id: 'p2', title: 'Agentic Skills', stage: 'framing' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '' },
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

  it('resolves a title with special characters via its cleaned slug', () => {
    const storageWithSpecialChars = {
      ...storage,
      pitches: [
        ...storage.pitches,
        { id: 'p3', title: 'Agentic Capabilities (Skills & Tools)', stage: 'building' as const, needle: null, frame_problem: '', frame_outcome: '', timebox_start: '', timebox_end: '' },
      ],
    }
    expect(
      resolvePitch(storageWithSpecialChars, 'agentic-capabilities-skills-tools')
    ).toEqual(storageWithSpecialChars.pitches[2])
  })
})
