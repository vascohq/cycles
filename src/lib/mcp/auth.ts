import { auth, clerkClient } from '@clerk/nextjs/server'
import { verifyClerkToken } from '@clerk/mcp-tools/next'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

export type OrgMembership = { id: string; slug: string }

export type McpAuthInfo = AuthInfo & {
  extra: { userId: string; memberships: OrgMembership[] }
}

export async function verifyMcpToken(
  _req: Request,
  bearerToken?: string
): Promise<McpAuthInfo | undefined> {
  const clerkAuth = await auth({ acceptsToken: ['oauth_token', 'api_key'] })
  if (!bearerToken || !clerkAuth.isAuthenticated) return undefined

  // A Clerk API key carries its own id, scopes and subject, so it has no OAuth
  // client: the key id stands in for clientId. A key made for an organization
  // has a null userId, and this server needs a user, so it refuses one.
  const authInfo: AuthInfo | undefined =
    clerkAuth.tokenType === 'api_key'
      ? {
          token: bearerToken,
          clientId: clerkAuth.id,
          scopes: clerkAuth.scopes,
          extra: { userId: clerkAuth.userId ?? undefined },
        }
      : verifyClerkToken(clerkAuth, bearerToken)
  if (!authInfo) return undefined

  // Only the API key path arrives here without a user id. verifyClerkToken
  // refuses an OAuth token that has none.
  const userId = authInfo.extra?.userId as string | undefined
  if (!userId) {
    console.error(
      'Clerk error: the API key has no userId. Create the key for a user, not for an organization.'
    )
    return undefined
  }

  const memberships = await fetchOrgMemberships(userId)
  if (!memberships) return undefined
  if (memberships.length === 0) {
    console.error(`Clerk error: user ${userId} is a member of no organization`)
    return undefined
  }

  return {
    ...authInfo,
    extra: { ...authInfo.extra, userId, memberships },
  }
}

async function fetchOrgMemberships(
  userId: string
): Promise<OrgMembership[] | undefined> {
  try {
    const client = await clerkClient()
    const { data } = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    })
    return data.map((m) => ({
      id: m.organization.id,
      slug: m.organization.slug,
    }))
  } catch (error) {
    console.error('Clerk error: could not list org memberships:', error)
    return undefined
  }
}

export function resolveOrg(
  memberships: OrgMembership[],
  orgInput?: string
): { ok: true; org: OrgMembership } | { ok: false; error: string } {
  if (orgInput) {
    const match = memberships.find(
      (m) => m.slug === orgInput || m.id === orgInput
    )
    if (!match) {
      return {
        ok: false,
        error: `You are not a member of "${orgInput}". Available orgs: ${listSlugs(memberships)}`,
      }
    }
    return { ok: true, org: match }
  }

  if (memberships.length === 1) {
    return { ok: true, org: memberships[0] }
  }

  return {
    ok: false,
    error: `You belong to ${memberships.length} organizations. Pass "org" to pick one: ${listSlugs(memberships)}`,
  }
}

function listSlugs(memberships: OrgMembership[]): string {
  return memberships.map((m) => `"${m.slug}"`).join(', ')
}
