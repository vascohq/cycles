'use server'

import { auth } from '@clerk/nextjs/server'
import { setIntegrationFeeds, setSlackWebhookUrl } from '@/lib/calendar/org-integrations'
import type { FeedInput } from '@/lib/calendar/integration-config'

export type SaveResult = { ok: true } | { ok: false; error: string }

async function requireOrgAdmin(): Promise<
  { ok: true; orgId: string } | { ok: false; error: string }
> {
  const { userId, orgId, has } = await auth()
  if (!userId) return { ok: false, error: 'Not authenticated.' }
  if (!orgId) {
    return { ok: false, error: 'Switch to an organization to configure integrations.' }
  }
  if (!has({ role: 'org:admin' })) {
    return { ok: false, error: 'Only organization admins can change integrations.' }
  }
  return { ok: true, orgId }
}

/**
 * Persist the org's calendar feeds. Admin-only and org-scoped. URLs are
 * write-only (ADR 0014): a row with a blank url keeps the stored one; a new row
 * must carry a url. The URLs only ever travel from this admin form to the
 * server, never back to any browser. Merge + validation happen in
 * setIntegrationFeeds.
 */
export async function saveIntegrationFeeds(feeds: FeedInput[]): Promise<SaveResult> {
  const gate = await requireOrgAdmin()
  if (!gate.ok) return gate

  try {
    await setIntegrationFeeds(gate.orgId, feeds)
    return { ok: true }
  } catch (err) {
    console.error('[integrations] saveIntegrationFeeds failed', err)
    const detail = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Could not save: ${detail}` }
  }
}

/**
 * Persist (or clear) the org's Slack webhook. Admin-only; the URL only travels
 * from this admin form to the server, never to a cycle viewer.
 */
export async function saveSlackWebhook(url: string): Promise<SaveResult> {
  const gate = await requireOrgAdmin()
  if (!gate.ok) return gate

  try {
    await setSlackWebhookUrl(gate.orgId, url)
    return { ok: true }
  } catch (err) {
    console.error('[integrations] saveSlackWebhook failed', err)
    const detail = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: `Could not save: ${detail}` }
  }
}
