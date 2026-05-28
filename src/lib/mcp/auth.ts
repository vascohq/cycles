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
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' })
  const authInfo = verifyClerkToken(clerkAuth, bearerToken)
  if (!authInfo) return undefined

  const userId = authInfo.extra?.userId as string | undefined
  if (!userId) return undefined

  const memberships = await fetchOrgMemberships(userId)
  if (!memberships || memberships.length === 0) return undefined

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
  } catch {
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
