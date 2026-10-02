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

vi.mock('./area-page', () => ({
  AreaPage: () => null,
}))

vi.mock('@/lib/users', () => ({
  getOrganizationUsers: vi.fn(async () => []),
}))

vi.mock('@/lib/mcp/liveblocks-reader', () => ({
  readCycleWindows: vi.fn(async () => []),
  getCycleStorage: vi.fn(async () => ({ pitches: [] })),
}))

import AreaRoute from './page'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)

function params(slug: string, areaId: string) {
  return { params: Promise.resolve({ slug, areaId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
})

describe('AreaRoute', () => {
  it('opens the area in the org-scoped Product Map room', async () => {
    const element: any = await AreaRoute(params('my-org', 'f1'))

    expect(element.props.roomId).toBe('org_456:product-map')
    expect(element.props.areaId).toBe('f1')
  })

  // A shared link from another workspace lands on the same area id in yours.
  it('redirects to the active workspace and keeps the area', async () => {
    await AreaRoute(params('stale-org', 'f1'))

    expect(mockRedirect).toHaveBeenCalledWith('/my-org/product/areas/f1')
  })

  // The id goes into a redirect, so it must never carry a path of its own.
  it('refuses an area id with slashes, dots or encoded characters', async () => {
    for (const bad of ['..', 'a/b', '%2F', 'x.y']) {
      await expect(AreaRoute(params('stale-org', bad))).rejects.toThrow('NEXT_NOT_FOUND')
    }
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
