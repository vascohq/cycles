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

import { createRoom } from './actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { liveblocks } from '@/lib/liveblocks'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)
const mockGetRoom = vi.mocked(liveblocks.getRoom)

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
  mockGetRoom.mockRejectedValue(new Error('not found')) // room does not exist
})

describe('createRoom', () => {
  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    await expect(createRoom(formData({ slug: 'ok' }))).rejects.toThrow(
      'Not authenticated'
    )
  })

  it('accepts a valid alphanumeric slug', async () => {
    await createRoom(formData({ slug: 'my-board', title: 'My Board' }))
    expect(mockRedirect).toHaveBeenCalledWith('/my-org/boards/my-board')
  })

  it('accepts slugs with underscores and hyphens', async () => {
    await createRoom(formData({ slug: 'board_1-test' }))
    expect(mockRedirect).toHaveBeenCalledWith('/my-org/boards/board_1-test')
  })

  describe('open redirect prevention', () => {
    it('rejects protocol-relative URLs (//evil.com)', async () => {
      await expect(
        createRoom(formData({ slug: '//evil.com' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with slashes', async () => {
      await expect(
        createRoom(formData({ slug: 'foo/bar' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with dots (path traversal)', async () => {
      await expect(
        createRoom(formData({ slug: '../../etc/passwd' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with encoded characters', async () => {
      await expect(
        createRoom(formData({ slug: '%2F%2Fevil.com' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('rejects empty slug', async () => {
      await expect(createRoom(formData({ slug: '' }))).rejects.toThrow(
        'Invalid slug'
      )
    })

    it('rejects missing slug', async () => {
      await expect(createRoom(formData({}))).rejects.toThrow('Invalid slug')
    })

    it('rejects slugs with spaces', async () => {
      await expect(
        createRoom(formData({ slug: 'my board' }))
      ).rejects.toThrow('Invalid slug')
    })

    it('ensures redirect stays on a local path', async () => {
      await createRoom(formData({ slug: 'safe-slug' }))
      const redirectUrl = mockRedirect.mock.calls[0][0] as string
      expect(redirectUrl).toMatch(/^\/[a-zA-Z0-9]/)
      expect(redirectUrl).not.toMatch(/^\/\//)
    })
  })
})
