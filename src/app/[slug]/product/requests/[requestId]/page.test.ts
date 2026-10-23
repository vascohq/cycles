import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

// notFound throws in Next, so a page that hits it renders nothing after it.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('./request-page', () => ({
  RequestPage: () => null,
}))

vi.mock('@/lib/users', () => ({
  getOrganizationUsers: vi.fn(async () => []),
}))

vi.mock('@/lib/mcp/liveblocks-reader', () => ({
  readCycleWindows: vi.fn(async () => []),
  getCycleStorage: vi.fn(async () => ({ pitches: [] })),
}))

import RequestRoute from './page'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)

function params(slug: string, requestId: string) {
  return { params: Promise.resolve({ slug, requestId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
})

describe('RequestRoute', () => {
  it('opens the request in the org-scoped Product Map room', async () => {
    const element: any = await RequestRoute(params('my-org', 'f1'))

    expect(element.props.roomId).toBe('org_456:product-map')
    expect(element.props.requestId).toBe('f1')
  })

  // A shared link from another workspace lands on the same request id in yours.
  it('redirects to the active workspace and keeps the request', async () => {
    await RequestRoute(params('stale-org', 'f1'))

    expect(mockRedirect).toHaveBeenCalledWith('/my-org/product/requests/f1')
  })

  // The id goes into a redirect, so it must never carry a path of its own.
  it('refuses a request id with slashes, dots or encoded characters', async () => {
    for (const bad of ['..', 'a/b', '%2F', 'x.y']) {
      await expect(RequestRoute(params('stale-org', bad))).rejects.toThrow('NEXT_NOT_FOUND')
    }
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
