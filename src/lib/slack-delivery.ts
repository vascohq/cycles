import { formatSlackMessage, type SlackMessageParams } from './slack-message'

export type SlackDeliveryResult =
  | { ok: true; delivered_at: string }
  | { ok: false; error: string }

// True when the org has a Slack webhook configured. The webhook now lives in
// per-org config (Clerk privateMetadata, see #139), so callers resolve it for
// the current org and pass it in. Both the move-needle route and the MCP
// post_update tool gate delivery on this.
export function isSlackConfigured(webhookUrl: string | null | undefined): boolean {
  return !!webhookUrl
}

// Single source of truth for posting a needle update to Slack. The HTTP route
// (browser-driven) and the MCP post_update tool both call this so the two paths
// stay byte-identical. Callers resolve the org's webhook and validate params
// first; the browser route does so against slackMessageSchema, the MCP tool
// builds them.
export async function deliverSlackUpdate(
  params: SlackMessageParams,
  webhookUrl: string | null | undefined
): Promise<SlackDeliveryResult> {
  if (!webhookUrl) {
    return { ok: false, error: 'Slack webhook not configured' }
  }

  const payload = formatSlackMessage(params)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const detail = await res.text()
    return { ok: false, error: `Slack delivery failed: ${detail}` }
  }

  return { ok: true, delivered_at: new Date().toISOString() }
}
