import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('./product-map', () => ({
  ProductMap: () => null,
}))

// The page reads the org's members so the frame detail can name a Frame owner.
// Clerk is stubbed here: this file is about routing, not about membership.
vi.mock('@/lib/users', () => ({
  getOrganizationUsers: vi.fn(async () => []),
}))

// The page reads the cycle BOUNDARIES, because freshness is counted in cycles.
// Stubbed so this file needs no Liveblocks credentials.
vi.mock('@/lib/mcp/liveblocks-reader', () => ({
  listCycleRooms: vi.fn(async () => []),
}))

import ProductMapPage from './page'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listCycleRooms } from '@/lib/mcp/liveblocks-reader'

const mockAuth = vi.mocked(auth)
const mockRedirect = vi.mocked(redirect)

function params(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    userId: 'user_123',
    orgId: 'org_456',
    orgSlug: 'my-org',
  } as any)
})

describe('ProductMapPage', () => {
  it('opens the org-scoped Product Map room', async () => {
    const element: any = await ProductMapPage(params('my-org'))
    expect(element.props.roomId).toBe('org_456:product-map')
  })

  // A team with no cycle can still open the Product Map (ADR 0021), so the
  // page reads no room metadata and never redirects a member away.
  it('loads without looking up a cycle', async () => {
    const element: any = await ProductMapPage(params('my-org'))
    expect(element).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('hands the frame detail the org members, so an owner reads as a name', async () => {
    const element: any = await ProductMapPage(params('my-org'))
    expect(element.props.organizationUsers).toEqual([])
  })

  // Freshness counts cycles, so the map reads their boundaries — while still
  // opening for an organization that has never created one (ADR 0021).
  it('hands over the cycle windows without requiring a cycle', async () => {
    const element: any = await ProductMapPage(params('my-org'))
    expect(element.props.cycles).toEqual([])
  })

  it('still opens when the cycle rooms cannot be read, with nothing aged', async () => {
    vi.mocked(listCycleRooms).mockRejectedValueOnce(new Error('liveblocks is down'))

    const element: any = await ProductMapPage(params('my-org'))

    expect(element.props.cycles).toEqual([])
  })

  it('falls back to the user id in a personal workspace', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      orgId: null,
      orgSlug: null,
    } as any)

    const element: any = await ProductMapPage(params('me'))
    expect(element.props.roomId).toBe('user_123:product-map')
  })

  it('redirects when the url slug is not the active workspace', async () => {
    await ProductMapPage(params('stale-org'))
    expect(mockRedirect).toHaveBeenCalledWith('/my-org/product-map')
  })
})
