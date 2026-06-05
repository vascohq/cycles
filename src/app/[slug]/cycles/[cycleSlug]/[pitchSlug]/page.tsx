import { ScopeMap } from './scope-map'
import { SlackConfigProvider } from '@/components/slack-config-context'
import { liveblocks } from '@/lib/liveblocks'
import { getCycleStorage, resolvePitch } from '@/lib/mcp/liveblocks-reader'
import { getOrganizationUsers } from '@/lib/users'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type PageParams = {
  params: Promise<{ slug: string; cycleSlug: string; pitchSlug: string }>
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { cycleSlug, pitchSlug } = await params
  const { userId, orgId } = await auth()
  if (!userId) return { title: 'Cycles' }

  const roomPrefix = orgId ?? userId

  try {
    const [room, storage] = await Promise.all([
      liveblocks.getRoom(`${roomPrefix}:cycle:${cycleSlug}`),
      getCycleStorage(roomPrefix, cycleSlug),
    ])
    const pitch = resolvePitch(storage, pitchSlug)
    const pitchLabel = pitch
      ? [pitch.emoji, pitch.title].filter(Boolean).join(' ')
      : pitchSlug
    return { title: `${pitchLabel} | ${room.metadata.title} | Cycles` }
  } catch {
    return { title: 'Scope Map not found | Cycles' }
  }
}

export default async function ScopeMapPage({ params }: PageParams) {
  const { slug, cycleSlug, pitchSlug } = await params
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
      <ScopeMap
        roomId={roomId}
        pitchSlug={pitchSlug}
        cycleSlug={cycleSlug}
        cycleTitle={cycleTitle!}
        slug={slug}
        organizationUsers={users}
      />
    </SlackConfigProvider>
  )
}
