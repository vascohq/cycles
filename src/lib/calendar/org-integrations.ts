import { clerkClient } from '@clerk/nextjs/server'
import {
  parseIntegrationConfig,
  mergeFeedInputs,
  redactFeeds,
  type FeedInput,
  type IntegrationConfig,
  type RedactedFeed,
} from './integration-config'

const EMPTY: IntegrationConfig = { feeds: [] }

/** What the settings page may safely receive — URLs/webhook are write-only. */
export type RedactedIntegrationConfig = {
  feeds: RedactedFeed[]
  slackConfigured: boolean
}

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
 * The redacted config safe to hand the browser: feed id/kind/label + whether a
 * URL is set, and whether Slack is configured — never the URLs themselves
 * (write-only secrets, ADR 0014).
 */
export async function getRedactedIntegrationConfig(
  orgId: string | null | undefined
): Promise<RedactedIntegrationConfig> {
  const config = await getIntegrationConfig(orgId)
  return {
    feeds: redactFeeds(config.feeds),
    slackConfigured: Boolean(config.slackWebhookUrl),
  }
}

/**
 * Apply the settings form's feed inputs, merging over the stored feeds so the
 * write-only URLs survive a label-only edit (ADR 0014) and preserving every
 * other key under `calendarIntegrations` — notably the Slack webhook (ADR 0011).
 * Validates before writing. Server-only; callers must enforce the admin check.
 */
export async function setIntegrationFeeds(orgId: string, inputs: FeedInput[]): Promise<void> {
  const client = await clerkClient()
  const org = await client.organizations.getOrganization({ organizationId: orgId })
  const existing = parseIntegrationConfig(org.privateMetadata?.[METADATA_KEY] ?? {})
  const raw = (org.privateMetadata?.[METADATA_KEY] ?? {}) as Record<string, unknown>

  const feeds = mergeFeedInputs(existing.feeds, inputs)
  const next = parseIntegrationConfig({ ...raw, feeds })

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
