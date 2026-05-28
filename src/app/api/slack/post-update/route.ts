import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { formatSlackMessage, slackMessageSchema } from '@/lib/slack-message'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'SLACK_WEBHOOK_URL not configured' },
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

  const payload = formatSlackMessage(parsed.data)

  const slackRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!slackRes.ok) {
    const slackBody = await slackRes.text()
    return NextResponse.json(
      { error: 'Slack delivery failed', detail: slackBody },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    delivered_at: new Date().toISOString(),
  })
}
