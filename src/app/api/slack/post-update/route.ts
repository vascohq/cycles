import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { slackMessageSchema } from '@/lib/slack-message'
import { deliverSlackUpdate, isSlackConfigured } from '@/lib/slack-delivery'
import { getSlackWebhookUrl } from '@/lib/calendar/org-integrations'

export async function POST(request: Request) {
  const { userId, orgId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = await getSlackWebhookUrl(orgId)
  if (!isSlackConfigured(webhookUrl)) {
    return NextResponse.json(
      { error: 'Slack webhook not configured for this organization' },
      { status: 503 }
    )
  }

  const parsed = slackMessageSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const result = await deliverSlackUpdate(parsed.data, webhookUrl)

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Slack delivery failed', detail: result.error },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, delivered_at: result.delivered_at })
}
