import { clerkClient } from '@clerk/nextjs/server'
import { parseIntegrationConfig, type IntegrationConfig } from './integration-config'

const EMPTY: IntegrationConfig = { feeds: [] }

// Key under the Clerk organization's privateMetadata where the calendar feed
// list (and, later, the Slack webhook) lives. privateMetadata keeps the
// capability-token URLs server-side — they never reach the browser.
const METADATA_KEY = 'calendarIntegrations'

/**
 * Read an organization's calendar integration config from Clerk
 * `privateMetadata`. Personal workspaces (no orgId), unconfigured orgs, and
 * malformed metadata all resolve to an empty config so the cycle window simply
 * renders without an overlay.
 */
export async function getIntegrationConfig(
  orgId: string | null | undefined
): Promise<IntegrationConfig> {
  if (!orgId) return EMPTY
  try {
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: orgId })
    return parseIntegrationConfig(org.privateMetadata?.[METADATA_KEY] ?? {})
  } catch {
    return EMPTY
  }
}
