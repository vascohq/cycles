import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}))

vi.mock('@clerk/mcp-tools/next', () => ({
  verifyClerkToken: vi.fn(),
}))

import { auth, clerkClient } from '@clerk/nextjs/server'
import { verifyClerkToken } from '@clerk/mcp-tools/next'
import { verifyMcpToken, resolveOrg } from './auth'

const mockAuth = vi.mocked(auth)
const mockClerkClient = vi.mocked(clerkClient)
const mockVerifyClerkToken = vi.mocked(verifyClerkToken)

const oauthAuth = { tokenType: 'oauth_token', isAuthenticated: true }

function makeRequest(): Request {
  return new Request('http://localhost/api/mcp')
}

function mockMembershipApi(orgs: { id: string; slug: string }[]) {
  mockClerkClient.mockResolvedValue({
    users: {
      getOrganizationMembershipList: vi.fn().mockResolvedValue({
        data: orgs.map((o) => ({ organization: o })),
      }),
    },
  } as never)
}

describe('verifyMcpToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined when Clerk did not authenticate the token', async () => {
    mockAuth.mockResolvedValue({
      tokenType: null,
      isAuthenticated: false,
    } as never)

    const result = await verifyMcpToken(makeRequest(), 'bad-token')
    expect(result).toBeUndefined()
    expect(mockVerifyClerkToken).not.toHaveBeenCalled()
  })

  it('returns undefined when verifyClerkToken returns undefined', async () => {
    mockAuth.mockResolvedValue(oauthAuth as never)
    mockVerifyClerkToken.mockReturnValue(undefined)

    const result = await verifyMcpToken(makeRequest(), 'bad-token')
    expect(result).toBeUndefined()
  })

  it('returns undefined when user has no org memberships', async () => {
    mockAuth.mockResolvedValue(oauthAuth as never)
    mockVerifyClerkToken.mockReturnValue({
      token: 'tok',
      scopes: ['profile'],
      clientId: 'client_1',
      extra: { userId: 'user_1' },
    })
    mockMembershipApi([])

    const result = await verifyMcpToken(makeRequest(), 'tok')
    expect(result).toBeUndefined()
  })

  it('returns authInfo with memberships when user belongs to one org', async () => {
    mockAuth.mockResolvedValue(oauthAuth as never)
    mockVerifyClerkToken.mockReturnValue({
      token: 'tok',
      scopes: ['profile'],
      clientId: 'client_1',
      extra: { userId: 'user_1' },
    })
    mockMembershipApi([{ id: 'org_1', slug: 'vasco' }])

    const result = await verifyMcpToken(makeRequest(), 'tok')
    expect(result?.extra).toEqual({
      userId: 'user_1',
      memberships: [{ id: 'org_1', slug: 'vasco' }],
    })
  })

  it('returns all memberships when user belongs to multiple orgs', async () => {
    mockAuth.mockResolvedValue(oauthAuth as never)
    mockVerifyClerkToken.mockReturnValue({
      token: 'tok',
      scopes: ['profile'],
      clientId: 'client_1',
      extra: { userId: 'user_1' },
    })
    mockMembershipApi([
      { id: 'org_1', slug: 'vasco' },
      { id: 'org_2', slug: 'acme' },
    ])

    const result = await verifyMcpToken(makeRequest(), 'tok')
    expect(result?.extra.memberships).toHaveLength(2)
  })

  it('returns undefined when Clerk API call throws', async () => {
    mockAuth.mockResolvedValue(oauthAuth as never)
    mockVerifyClerkToken.mockReturnValue({
      token: 'tok',
      scopes: ['profile'],
      clientId: 'client_1',
      extra: { userId: 'user_1' },
    })
    mockClerkClient.mockRejectedValue(new Error('Clerk down'))

    const result = await verifyMcpToken(makeRequest(), 'tok')
    expect(result).toBeUndefined()
  })
})

describe('verifyMcpToken with an API key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockApiKeyAuth(userId: string | null) {
    mockAuth.mockResolvedValue({
      tokenType: 'api_key',
      isAuthenticated: true,
      id: 'ak_1',
      userId,
    } as never)
  }

  it('accepts a key whose user has memberships, without verifyClerkToken', async () => {
    mockApiKeyAuth('user_stewart')
    mockMembershipApi([{ id: 'org_1', slug: 'vasco' }])

    const result = await verifyMcpToken(makeRequest(), 'ak_secret')
    expect(mockVerifyClerkToken).not.toHaveBeenCalled()
    expect(result).toEqual({
      token: 'ak_secret',
      clientId: 'ak_1',
      scopes: [],
      extra: {
        userId: 'user_stewart',
        memberships: [{ id: 'org_1', slug: 'vasco' }],
      },
    })
  })

  it('refuses a key with no user id', async () => {
    mockApiKeyAuth(null)
    mockMembershipApi([{ id: 'org_1', slug: 'vasco' }])

    const result = await verifyMcpToken(makeRequest(), 'ak_secret')
    expect(result).toBeUndefined()
    expect(mockClerkClient).not.toHaveBeenCalled()
  })

  it('refuses a key whose user has no memberships', async () => {
    mockApiKeyAuth('user_stewart')
    mockMembershipApi([])

    const result = await verifyMcpToken(makeRequest(), 'ak_secret')
    expect(result).toBeUndefined()
  })

  it('refuses a key Clerk did not authenticate', async () => {
    mockAuth.mockResolvedValue({
      tokenType: 'api_key',
      isAuthenticated: false,
    } as never)

    const result = await verifyMcpToken(makeRequest(), 'ak_bad')
    expect(result).toBeUndefined()
    expect(mockClerkClient).not.toHaveBeenCalled()
  })
})

describe('resolveOrg', () => {
  const memberships = [
    { id: 'org_1', slug: 'vasco' },
    { id: 'org_2', slug: 'acme' },
  ]

  it('auto-selects the only org when input is omitted and user has one org', () => {
    const result = resolveOrg([memberships[0]])
    expect(result).toEqual({ ok: true, org: memberships[0] })
  })

  it('returns error when input is omitted and user has multiple orgs', () => {
    const result = resolveOrg(memberships)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('vasco')
      expect(result.error).toContain('acme')
    }
  })

  it('matches by slug', () => {
    const result = resolveOrg(memberships, 'acme')
    expect(result).toEqual({ ok: true, org: memberships[1] })
  })

  it('matches by id', () => {
    const result = resolveOrg(memberships, 'org_1')
    expect(result).toEqual({ ok: true, org: memberships[0] })
  })

  it('returns error when input does not match a membership', () => {
    const result = resolveOrg(memberships, 'unknown')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unknown')
      expect(result.error).toContain('vasco')
    }
  })
})
