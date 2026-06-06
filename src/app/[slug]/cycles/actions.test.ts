import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    initializeStorageDocument: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { createCycleRoom } from './actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { liveblocks } from '@/lib/liveblocks'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)
const mockGetRoom = vi.mocked(liveblocks.getRoom)
const mockCreateRoom = vi.mocked(liveblocks.createRoom)
const mockInitStorage = vi.mocked(liveblocks.initializeStorageDocument)

function formData(entries: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
  mockGetRoom.mockRejectedValue(new Error('not found'))
})

describe('createCycleRoom', () => {
  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    await expect(
      createCycleRoom(
        formData({
          name: 'Build Cycle 1',
          slug: 'build-cycle-1',
          type: 'build',
          start_date: '2026-06-01',
          end_date: '2026-07-12',
        })
      )
    ).rejects.toThrow('Not authenticated')
  })

  describe('slug validation', () => {
    it('rejects empty slug', async () => {
      await expect(
        createCycleRoom(formData({ slug: '', name: 'Test' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects missing slug', async () => {
      await expect(
        createCycleRoom(formData({ name: 'Test' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with slashes', async () => {
      await expect(
        createCycleRoom(formData({ slug: 'foo/bar' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with dots (path traversal)', async () => {
      await expect(
        createCycleRoom(formData({ slug: '../../etc/passwd' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects protocol-relative URLs (//evil.com)', async () => {
      await expect(
        createCycleRoom(formData({ slug: '//evil.com' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with spaces', async () => {
      await expect(
        createCycleRoom(formData({ slug: 'my cycle' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('accepts valid alphanumeric slug with hyphens', async () => {
      await createCycleRoom(
        formData({
          slug: 'build-cycle-1',
          name: 'Build Cycle 1',
          type: 'build',
          start_date: '2026-06-01',
          end_date: '2026-07-12',
        })
      )
      // Should not throw
    })
  })

  it('creates room with {orgId}:cycle:{slug} ID pattern', async () => {
    await createCycleRoom(
      formData({
        slug: 'build-cycle-1',
        name: 'Build Cycle 1',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockCreateRoom).toHaveBeenCalledWith(
      'org_456:cycle:build-cycle-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          title: 'Build Cycle 1',
          createdBy: 'user_123',
          type: 'build',
          start_date: '2026-06-01',
          end_date: '2026-07-12',
        }),
        defaultAccesses: ['room:write'],
      })
    )
  })

  it('uses userId as prefix when no orgId', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      orgId: null,
      orgSlug: null,
    } as any)

    await createCycleRoom(
      formData({
        slug: 'my-cycle',
        name: 'My Cycle',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockCreateRoom).toHaveBeenCalledWith(
      'user_123:cycle:my-cycle',
      expect.anything()
    )
  })

  it('initializes CycleStorage with cycle metadata and empty collections', async () => {
    await createCycleRoom(
      formData({
        slug: 'build-cycle-1',
        name: 'Build Cycle 1',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockInitStorage).toHaveBeenCalledWith(
      'org_456:cycle:build-cycle-1',
      {
        liveblocksType: 'LiveObject',
        data: {
          cycle: {
            liveblocksType: 'LiveObject',
            data: {
              name: 'Build Cycle 1',
              type: 'build',
              start_date: '2026-06-01',
              end_date: '2026-07-12',
            },
          },
          pitches: { liveblocksType: 'LiveList', data: [] },
          scopes: { liveblocksType: 'LiveList', data: [] },
          tasks: { liveblocksType: 'LiveList', data: [] },
          updates: { liveblocksType: 'LiveList', data: [] },
          parkingItems: { liveblocksType: 'LiveList', data: [] },
        },
      }
    )
  })

  it('redirects to /[orgSlug]/cycles/[slug] after creation', async () => {
    await createCycleRoom(
      formData({
        slug: 'build-cycle-1',
        name: 'Build Cycle 1',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockRedirect).toHaveBeenCalledWith('/my-org/cycles/build-cycle-1')
  })

  it('redirects to /me/cycles/[slug] for personal workspace', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      orgId: null,
      orgSlug: null,
    } as any)

    await createCycleRoom(
      formData({
        slug: 'my-cycle',
        name: 'My Cycle',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockRedirect).toHaveBeenCalledWith('/me/cycles/my-cycle')
  })

  it('skips room creation if room already exists', async () => {
    mockGetRoom.mockResolvedValue({} as any)

    await createCycleRoom(
      formData({
        slug: 'existing-cycle',
        name: 'Existing Cycle',
        type: 'build',
        start_date: '2026-06-01',
        end_date: '2026-07-12',
      })
    )

    expect(mockCreateRoom).not.toHaveBeenCalled()
    expect(mockInitStorage).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/my-org/cycles/existing-cycle')
  })
})
