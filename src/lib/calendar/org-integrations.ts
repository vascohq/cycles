import { clerkClient } from '@clerk/nextjs/server'
import {
  parseIntegrationConfig,
  type Feed,
  type IntegrationConfig,
} from './integration-config'

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

/**
 * Replace the org's feed list, preserving every other key already under
 * `calendarIntegrations` (notably the Slack webhook — ADR 0011: a partial save
 * must never wipe a sibling field). Validates through the schema before
 * writing. Server-only; callers must enforce the admin check.
 */
export async function setIntegrationFeeds(orgId: string, feeds: Feed[]): Promise<void> {
  const client = await clerkClient()
  const org = await client.organizations.getOrganization({ organizationId: orgId })
  const existing = (org.privateMetadata?.[METADATA_KEY] ?? {}) as Record<string, unknown>

  // Validate the merged shape; throws on bad input before anything is written.
  const next = parseIntegrationConfig({ ...existing, feeds })

  await client.organizations.updateOrganization(orgId, {
    privateMetadata: { [METADATA_KEY]: next },
  })
}

/**
 * The org's Slack webhook URL, or undefined. Used by the page boundaries and
 * the delivery paths to decide whether Slack is configured (see #139).
 */
export async function getSlackWebhookUrl(
  orgId: string | null | undefined
): Promise<string | undefined> {
  if (!orgId) return undefined
  return (await getIntegrationConfig(orgId)).slackWebhookUrl
}

/**
 * Set (or clear, when given an empty string) the org's Slack webhook,
 * preserving the feed list (ADR 0011). Server-only; callers enforce admin.
 */
export async function setSlackWebhookUrl(orgId: string, url: string): Promise<void> {
  const client = await clerkClient()
  const org = await client.organizations.getOrganization({ organizationId: orgId })
  const existing = (org.privateMetadata?.[METADATA_KEY] ?? {}) as Record<string, unknown>

  const merged = { ...existing }
  const trimmed = url.trim()
  if (trimmed) merged.slackWebhookUrl = trimmed
  else delete merged.slackWebhookUrl

  const next = parseIntegrationConfig(merged)
  await client.organizations.updateOrganization(orgId, {
    privateMetadata: { [METADATA_KEY]: next },
  })
}
