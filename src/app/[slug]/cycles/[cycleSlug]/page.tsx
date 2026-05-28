import { MissionControl } from './mission-control'
import { SlackConfigProvider } from '@/components/slack-config-context'
import { liveblocks } from '@/lib/liveblocks'
import { getOrganizationUsers } from '@/lib/users'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type PageParams = {
  params: Promise<{ slug: string; cycleSlug: string }>
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { cycleSlug } = await params
  const { userId, orgId } = await auth()
  if (!userId) return { title: 'Cycles' }

  const roomPrefix = orgId ?? userId
  const roomId = `${roomPrefix}:cycle:${cycleSlug}`

  try {
    const room = await liveblocks.getRoom(roomId)
    return { title: `${room.metadata.title} | Mission Control | Cycles` }
  } catch {
    return { title: 'Cycle not found | Cycles' }
  }
}

export default async function MissionControlPage({ params }: PageParams) {
  const { slug, cycleSlug } = await params
  const authResult = await auth()
  const { userId, orgId } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const roomPrefix = orgId ?? userId
  const roomId = `${roomPrefix}:cycle:${cycleSlug}`

  let cycleTitle: string
  try {
    const room = await liveblocks.getRoom(roomId)
    cycleTitle = String(room.metadata.title)
  } catch {
    notFound()
  }

  const users = await getOrganizationUsers(orgId)

  return (
    <SlackConfigProvider enabled={!!process.env.SLACK_WEBHOOK_URL}>
      <MissionControl
        roomId={roomId}
        cycleSlug={cycleSlug}
        cycleTitle={cycleTitle!}
        slug={slug}
        organizationUsers={users}
      />
    </SlackConfigProvider>
  )
}
