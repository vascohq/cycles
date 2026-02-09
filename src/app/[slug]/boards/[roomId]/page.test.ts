import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    getRoom: vi.fn(),
  },
}))

vi.mock('@/lib/users', () => ({
  getOrganizationUsers: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}))

import { generateMetadata } from './page'
import { auth } from '@clerk/nextjs/server'
import { liveblocks } from '@/lib/liveblocks'

const mockAuth = vi.mocked(auth)
const mockGetRoom = vi.mocked(liveblocks.getRoom)

function params(slug: string, roomId: string) {
  return { params: Promise.resolve({ slug, roomId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
})

describe('generateMetadata', () => {
  it('returns board title in page title', async () => {
    mockGetRoom.mockResolvedValue({
      metadata: { title: 'Sprint Planning' },
    } as any)

    const metadata = await generateMetadata(params('my-org', 'sprint-planning'))
    expect(metadata.title).toBe('Sprint Planning | Cycles')
  })

  it('returns fallback title when room is not found', async () => {
    mockGetRoom.mockRejectedValue(new Error('not found'))

    const metadata = await generateMetadata(params('my-org', 'missing-board'))
    expect(metadata.title).toBe('Board not found | Cycles')
  })

  it('returns fallback title when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const metadata = await generateMetadata(params('my-org', 'some-board'))
    expect(metadata.title).toBe('Cycles')
  })
})
