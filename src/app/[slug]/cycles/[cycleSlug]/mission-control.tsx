'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import {
  CycleRoomProvider,
  useCycleStorage,
  cycleInitialStorage,
} from '@/cycle-room-context'
import type { OrganizationUser } from '@/lib/users'
import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { MissionControlView } from '@/components/mission-control'
import { derivePitchCards, partitionByStage } from '@/lib/mission-control-helpers'

type MissionControlProps = {
  roomId: string
  cycleSlug: string
  cycleTitle: string
  channelName: string
  slug: string
  organizationUsers: OrganizationUser[]
}

export function MissionControl({
  roomId,
  cycleSlug,
  cycleTitle,
  channelName,
  slug,
  organizationUsers,
}: MissionControlProps) {
  return (
    <OrganizationUsersProvider organizationUsers={organizationUsers}>
      <CycleRoomProvider
        id={roomId}
        initialPresence={{}}
        initialStorage={cycleInitialStorage()}
      >
        <ClientSideSuspense
          fallback={
            <main className="mt-16 w-full max-w-screen-lg mx-auto px-6 text-center">
              Loading…
            </main>
          }
        >
          {() => (
            <MissionControlWired
              cycleSlug={cycleSlug}
              cycleTitle={cycleTitle}
              channelName={channelName}
              slug={slug}
            />
          )}
        </ClientSideSuspense>
      </CycleRoomProvider>
    </OrganizationUsersProvider>
  )
}

function MissionControlWired({
  cycleSlug,
  cycleTitle,
  channelName,
  slug,
}: {
  cycleSlug: string
  cycleTitle: string
  channelName: string
  slug: string
}) {
  const pitches = useCycleStorage((root) => [...root.pitches])
  const scopes = useCycleStorage((root) => [...root.scopes])
  const tasks = useCycleStorage((root) => [...root.tasks])
  const updates = useCycleStorage((root) => [...root.updates])

  const cards = derivePitchCards(pitches, scopes, tasks, updates)
  const { inFlight, done } = partitionByStage(cards)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <MissionControlView
      slug={slug}
      cycleSlug={cycleSlug}
      cycleTitle={cycleTitle}
      channelName={channelName}
      today={today}
      inFlight={inFlight}
      done={done}
    />
  )
}
