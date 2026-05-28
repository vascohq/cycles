'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import {
  CycleRoomProvider,
  useCycleStorage,
  useCycleMutation,
  cycleInitialStorage,
} from '@/cycle-room-context'
import type { OrganizationUser } from '@/lib/users'
import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { MissionControlView } from '@/components/mission-control'
import { derivePitchCards, partitionByStage } from '@/lib/mission-control-helpers'
import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/client'

type MissionControlProps = {
  roomId: string
  cycleSlug: string
  cycleTitle: string
  slug: string
  organizationUsers: OrganizationUser[]
  slackEnabled: boolean
}

export function MissionControl({
  roomId,
  cycleSlug,
  cycleTitle,
  slug,
  organizationUsers,
  slackEnabled,
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
              slug={slug}
              slackEnabled={slackEnabled}
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
  slug,
  slackEnabled,
}: {
  cycleSlug: string
  cycleTitle: string
  slug: string
  slackEnabled: boolean
}) {
  const pitches = useCycleStorage((root) => [...root.pitches])
  const scopes = useCycleStorage((root) => [...root.scopes])
  const tasks = useCycleStorage((root) => [...root.tasks])
  const updates = useCycleStorage((root) => [...root.updates])

  const cycle = useCycleStorage((root) => ({
    start_date: root.cycle.start_date,
    end_date: root.cycle.end_date,
  }))

  const onCreatePitch = useCycleMutation(
    ({ storage }, title: string) => {
      storage.get('pitches').push(
        new LiveObject({
          id: nanoid(),
          title,
          stage: 'framing' as const,
          needle: null,
          frame_problem: '',
          frame_outcome: '',
          timebox_start: cycle.start_date,
          timebox_end: cycle.end_date,
        })
      )
    },
    [cycle.start_date, cycle.end_date]
  )

  const cards = derivePitchCards(pitches, scopes, tasks, updates)
  const { inFlight, done } = partitionByStage(cards)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <MissionControlView
      slug={slug}
      cycleSlug={cycleSlug}
      cycleTitle={cycleTitle}
      today={today}
      slackEnabled={slackEnabled}
      inFlight={inFlight}
      done={done}
      onCreatePitch={onCreatePitch}
    />
  )
}
