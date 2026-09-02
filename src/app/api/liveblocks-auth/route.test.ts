import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('@/lib/liveblocks', () => ({
  liveblocks: {
    prepareSession: vi.fn(),
  },
}))

import { POST } from './route'
import { auth, currentUser } from '@clerk/nextjs/server'
import { liveblocks } from '@/lib/liveblocks'
import { productMapRoomId } from '@/product-map-liveblocks.config'

const mockAuth = vi.mocked(auth)
const mockCurrentUser = vi.mocked(currentUser)
const mockPrepareSession = vi.mocked(liveblocks.prepareSession)

const allow = vi.fn()

function request() {
  return new Request('http://localhost/api/liveblocks-auth', { method: 'POST' })
}

/** The room patterns the endpoint granted, as glob strings. */
function grantedPatterns(): string[] {
  return allow.mock.calls.map((call) => call[0] as string)
}

/** Whether any granted pattern covers `roomId`. */
function grants(roomId: string): boolean {
  return grantedPatterns().some((pattern) =>
    pattern.endsWith('*')
      ? roomId.startsWith(pattern.slice(0, -1))
      : roomId === pattern
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCurrentUser.mockResolvedValue(null as any)
  mockPrepareSession.mockReturnValue({
    allow,
    FULL_ACCESS: 'room:write',
    authorize: vi.fn().mockResolvedValue({ status: 200, body: '{}' }),
  } as any)
  mockAuth.mockResolvedValue({ userId: 'user_123', orgId: 'org_456' } as any)
})

describe('POST /api/liveblocks-auth', () => {
  it('grants a member of the organization access to the Product Map room', async () => {
    await POST(request())
    expect(grants(productMapRoomId('org_456'))).toBe(true)
  })

  it('grants the personal Product Map room when there is no organization', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: null } as any)

    await POST(request())
    expect(grants(productMapRoomId('user_123'))).toBe(true)
  })

  it('grants no room of another organization', async () => {
    await POST(request())
    expect(grants(productMapRoomId('org_999'))).toBe(false)
    expect(grants('org_999:cycle:q3-build')).toBe(false)
  })

  it('rejects a caller with no session', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(allow).not.toHaveBeenCalled()
  })
})
