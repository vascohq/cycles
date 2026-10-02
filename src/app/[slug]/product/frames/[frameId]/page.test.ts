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

vi.mock('./frame-page', () => ({
  FramePage: () => null,
}))

vi.mock('@/lib/users', () => ({
  getOrganizationUsers: vi.fn(async () => []),
}))

vi.mock('@/lib/mcp/liveblocks-reader', () => ({
  readCycleWindows: vi.fn(async () => []),
  getCycleStorage: vi.fn(async () => ({ pitches: [] })),
}))

import FrameRoute from './page'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)

function params(slug: string, frameId: string) {
  return { params: Promise.resolve({ slug, frameId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
})

describe('FrameRoute', () => {
  it('opens the frame in the org-scoped Product Map room', async () => {
    const element: any = await FrameRoute(params('my-org', 'f1'))

    expect(element.props.roomId).toBe('org_456:product-map')
    expect(element.props.frameId).toBe('f1')
  })

  // A shared link from another workspace lands on the same frame id in yours.
  it('redirects to the active workspace and keeps the frame', async () => {
    await FrameRoute(params('stale-org', 'f1'))

    expect(mockRedirect).toHaveBeenCalledWith('/my-org/product/frames/f1')
  })

  // The id goes into a redirect, so it must never carry a path of its own.
  it('refuses a frame id with slashes, dots or encoded characters', async () => {
    for (const bad of ['..', 'a/b', '%2F', 'x.y']) {
      await expect(FrameRoute(params('stale-org', bad))).rejects.toThrow('NEXT_NOT_FOUND')
    }
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
