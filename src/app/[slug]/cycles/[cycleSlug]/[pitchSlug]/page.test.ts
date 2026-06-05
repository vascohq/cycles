import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    getRoom: vi.fn(),
  },
}))

vi.mock('@/lib/mcp/liveblocks-reader', () => ({
  getCycleStorage: vi.fn(),
  resolvePitch: vi.fn(),
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
import { getCycleStorage, resolvePitch } from '@/lib/mcp/liveblocks-reader'

const mockAuth = vi.mocked(auth)
const mockGetRoom = vi.mocked(liveblocks.getRoom)
const mockGetCycleStorage = vi.mocked(getCycleStorage)
const mockResolvePitch = vi.mocked(resolvePitch)

function params(slug: string, cycleSlug: string, pitchSlug: string) {
  return { params: Promise.resolve({ slug, cycleSlug, pitchSlug }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
  mockGetRoom.mockResolvedValue({ metadata: { title: 'Q3 Build Cycle' } } as any)
  mockGetCycleStorage.mockResolvedValue({} as any)
})

describe('generateMetadata', () => {
  it('returns pitch emoji and title in page title', async () => {
    mockResolvePitch.mockReturnValue({ emoji: '🔐', title: 'Auth Redesign' } as any)

    const metadata = await generateMetadata(params('my-org', 'q3-build', 'auth-redesign'))
    expect(metadata.title).toBe('🔐 Auth Redesign | Q3 Build Cycle | Cycles')
  })

  it('returns pitch title without emoji when emoji is unset', async () => {
    mockResolvePitch.mockReturnValue({ emoji: '', title: 'Auth Redesign' } as any)

    const metadata = await generateMetadata(params('my-org', 'q3-build', 'auth-redesign'))
    expect(metadata.title).toBe('Auth Redesign | Q3 Build Cycle | Cycles')
  })

  it('falls back to slug when pitch cannot be resolved', async () => {
    mockResolvePitch.mockReturnValue(undefined)

    const metadata = await generateMetadata(params('my-org', 'q3-build', 'auth-redesign'))
    expect(metadata.title).toBe('auth-redesign | Q3 Build Cycle | Cycles')
  })

  it('returns fallback title when room is not found', async () => {
    mockGetRoom.mockRejectedValue(new Error('not found'))

    const metadata = await generateMetadata(params('my-org', 'missing', 'some-pitch'))
    expect(metadata.title).toBe('Scope Map not found | Cycles')
  })

  it('returns fallback title when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const metadata = await generateMetadata(params('my-org', 'q3-build', 'auth-redesign'))
    expect(metadata.title).toBe('Cycles')
  })
})
