import { MissionControl } from './mission-control'
import { SlackConfigProvider } from '@/components/slack-config-context'
import { liveblocks } from '@/lib/liveblocks'
import { cycleNeighbors, type CycleSummary } from '@/lib/cycle-list-engine'
import { getOrganizationUsers } from '@/lib/users'
import { getIntegrationConfig } from '@/lib/calendar/org-integrations'
import { fetchOverlayBands } from '@/lib/calendar/feed-fetcher'
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

  // Chronological neighbors for the cycle stepper (cheap metadata-only query).
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${roomPrefix}:cycle:"`,
  })
  const cycleSummaries: CycleSummary[] = rooms.map((room) => ({
    slug: room.id.split(':').slice(2).join(':'),
    title: String(room.metadata.title ?? 'Untitled cycle'),
    type: room.metadata.type === 'cooldown' ? 'cooldown' : 'build',
    start_date: room.metadata.start_date ? String(room.metadata.start_date) : '',
    end_date: room.metadata.end_date ? String(room.metadata.end_date) : '',
    archived: room.metadata.archived === 'true',
  }))
  const { prev: prevCycle, next: nextCycle } = cycleNeighbors(cycleSummaries, cycleSlug)

  // Calendar overlays are external reference data fetched server-side, never
  // stored in Liveblocks (ADR 0014). We expand into a wide range around today;
  // the client clips bands to the actual cycle window. Fail-soft throughout.
  const today = new Date().toISOString().slice(0, 10)
  const year = Number(today.slice(0, 4))
  const integrations = await getIntegrationConfig(orgId)
  const cycleBands = await fetchOverlayBands(integrations, {
    start: `${year - 1}-01-01`,
    end: `${year + 1}-12-31`,
  })

  return (
    <SlackConfigProvider enabled={!!integrations.slackWebhookUrl}>
      <MissionControl
        roomId={roomId}
        cycleSlug={cycleSlug}
        cycleTitle={cycleTitle!}
        slug={slug}
        organizationUsers={users}
        cycleBands={cycleBands}
        prevCycleSlug={prevCycle?.slug}
        prevCycleTitle={prevCycle?.title}
        nextCycleSlug={nextCycle?.slug}
        nextCycleTitle={nextCycle?.title}
      />
    </SlackConfigProvider>
  )
}
