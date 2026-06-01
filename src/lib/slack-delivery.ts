import { formatSlackMessage, type SlackMessageParams } from './slack-message'

export type SlackDeliveryResult =
  | { ok: true; delivered_at: string }
  | { ok: false; error: string }

type Env = Record<string, string | undefined>

// True when a Slack webhook is configured for this environment. Both the
// move-needle route and the MCP post_update tool gate delivery on this.
export function isSlackConfigured(env: Env = process.env): boolean {
  return !!env.SLACK_WEBHOOK_URL
}

// Single source of truth for posting a needle update to Slack. The HTTP route
// (browser-driven) and the MCP post_update tool both call this so the two paths
// stay byte-identical. Callers are responsible for validating params first; the
// browser route does so against slackMessageSchema, the MCP tool builds them.
export async function deliverSlackUpdate(
  params: SlackMessageParams,
  env: Env = process.env
): Promise<SlackDeliveryResult> {
  const webhookUrl = env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return { ok: false, error: 'SLACK_WEBHOOK_URL not configured' }
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
