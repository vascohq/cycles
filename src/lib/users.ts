import { clerkClient } from '@clerk/nextjs/server'

export interface OrganizationUser {
  userId: string
  name: string
  /** The member's email / identifier — used to resolve MCP assignee refs. */
  email: string
  initials: string
  hasImage: boolean
  imageUrl: string
}

// Resolve an MCP assignee reference to a Clerk userId. Matches a raw userId or
// an email (case-insensitive) only — never a display name, which would be
// ambiguous. Returns null when nothing matches.
export function resolveAssigneeRef(
  ref: string,
  orgUsers: OrganizationUser[]
): string | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  const byId = orgUsers.find((u) => u.userId === trimmed)
  if (byId) return byId.userId
  const lower = trimmed.toLowerCase()
  const byEmail = orgUsers.find((u) => u.email.toLowerCase() === lower)
  return byEmail ? byEmail.userId : null
}

export async function getOrganizationUsers(
  organizationId?: string | null
): Promise<OrganizationUser[]> {
  if (!organizationId) return []

  const { data: memberships } =
    await (await clerkClient()).organizations.getOrganizationMembershipList({
      organizationId,
      limit: 100,
    })
  return memberships
    .map((m) => m.publicUserData)
    .filter(Boolean)
    .map<OrganizationUser>((publicUserData) => ({
      userId: publicUserData.userId,
      email: publicUserData.identifier,
      name:
        [publicUserData.firstName, publicUserData.lastName]
          .filter(Boolean)
          .join(' ') || publicUserData.identifier.replace(/@.*$/, '@…'),
      initials:
        [publicUserData.firstName?.[0], publicUserData.lastName?.[0]]
          .filter(Boolean)
          .join('')
          .toUpperCase() || publicUserData.identifier[0].toUpperCase() + '@',
      imageUrl: publicUserData.imageUrl,
      hasImage: publicUserData.hasImage,
    }))
    .sort((first, second) => first.name.localeCompare(second.name))
}
