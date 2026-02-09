import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    initializeStorageDocument: vi.fn(),
    updateRoom: vi.fn(),
    updateRoomId: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { updateBoard } from './actions'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { liveblocks } from '@/lib/liveblocks'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)
const mockGetRoom = vi.mocked(liveblocks.getRoom)
const mockUpdateRoom = vi.mocked(liveblocks.updateRoom)
const mockUpdateRoomId = vi.mocked(liveblocks.updateRoomId)

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
  mockGetRoom.mockResolvedValue({
    metadata: {
      title: 'Old Title',
      createdBy: 'user_123',
      createdOn: '2025-01-01T00:00:00.000Z',
    },
  } as any)
})

describe('updateBoard', () => {
  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    await expect(
      updateBoard(formData({ roomId: 'org_456:my-board', title: 'New' }))
    ).rejects.toThrow('Not authenticated')
  })

  it('rejects roomId not owned by the current org', async () => {
    await expect(
      updateBoard(
        formData({ roomId: 'other_org:my-board', title: 'New Title' })
      )
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects missing roomId', async () => {
    await expect(
      updateBoard(formData({ title: 'New Title' }))
    ).rejects.toThrow('Unauthorized')
  })

  it('updates title when changed', async () => {
    await updateBoard(
      formData({
        roomId: 'org_456:my-board',
        title: 'New Title',
        slug: 'my-board',
        orgId: 'org_456',
      })
    )
    expect(mockUpdateRoom).toHaveBeenCalledWith('org_456:my-board', {
      metadata: expect.objectContaining({ title: 'New Title' }),
    })
  })

  it('skips updateRoom when title is unchanged', async () => {
    await updateBoard(
      formData({
        roomId: 'org_456:my-board',
        title: 'Old Title',
        slug: 'my-board',
        orgId: 'org_456',
      })
    )
    expect(mockUpdateRoom).not.toHaveBeenCalled()
  })

  it('updates roomId when slug changes', async () => {
    await updateBoard(
      formData({
        roomId: 'org_456:my-board',
        title: 'Old Title',
        slug: 'new-slug',
        orgId: 'org_456',
      })
    )
    expect(mockUpdateRoomId).toHaveBeenCalledWith({
      currentRoomId: 'org_456:my-board',
      newRoomId: 'org_456:new-slug',
    })
  })

  it('skips updateRoomId when slug is unchanged', async () => {
    await updateBoard(
      formData({
        roomId: 'org_456:my-board',
        title: 'Old Title',
        slug: 'my-board',
        orgId: 'org_456',
      })
    )
    expect(mockUpdateRoomId).not.toHaveBeenCalled()
  })

  it('redirects to boards page after update', async () => {
    await updateBoard(
      formData({
        roomId: 'org_456:my-board',
        title: 'Old Title',
        slug: 'my-board',
        orgId: 'org_456',
      })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/my-org/boards')
  })

  it('uses "me" slug when orgSlug is not set', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      orgId: null,
      orgSlug: null,
    } as any)
    await updateBoard(
      formData({
        roomId: 'user_123:my-board',
        title: 'Old Title',
        slug: 'my-board',
        orgId: 'user_123',
      })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/me/boards')
  })
})
