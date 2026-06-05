'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import { MissionControlSkeleton } from '@/components/mission-control'
import {
  CycleRoomProvider,
  useCycleStorage,
  useCycleMutation,
  cycleInitialStorage,
} from '@/cycle-room-context'
import type { OrganizationUser } from '@/lib/users'
import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { MissionControlView } from '@/components/mission-control'
import { useSlackEnabled } from '@/components/slack-config-context'
import { derivePitchCards, groupBySquad } from '@/lib/mission-control-helpers'
import { useRegisterPalettePitches } from '@/components/command-palette/command-palette-context'
import { slugify } from '@/lib/slugify'
import { getTeamToday } from '@/lib/team-time'
import { useMemo } from 'react'
import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/client'

type MissionControlProps = {
  roomId: string
  cycleSlug: string
  cycleTitle: string
  slug: string
  organizationUsers: OrganizationUser[]
}

export function MissionControl({
  roomId,
  cycleSlug,
  cycleTitle,
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
        <ClientSideSuspense fallback={<MissionControlSkeleton />}>
          {() => (
            <MissionControlWired
              cycleSlug={cycleSlug}
              cycleTitle={cycleTitle}
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
  slug,
}: {
  cycleSlug: string
  cycleTitle: string
  slug: string
}) {
  const pitches = useCycleStorage((root) => [...root.pitches])
  const scopes = useCycleStorage((root) => [...root.scopes])
  const tasks = useCycleStorage((root) => [...root.tasks])
  const updates = useCycleStorage((root) => [...root.updates])
  const squads = useCycleStorage((root) => [...root.squads])

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
          emoji: '',
          notion_url: '',
        })
      )
    },
    [cycle.start_date, cycle.end_date]
  )

  // Register this cycle's pitches into the command palette while we're in the room.
  const palettePitches = useMemo(
    () =>
      pitches.map((p) => ({
        id: p.id,
        title: p.title,
        emoji: p.emoji ?? '',
        stage: p.stage,
        zone: p.needle?.zone ?? null,
        href: `/${slug}/cycles/${cycleSlug}/${slugify(p.title)}`,
      })),
    [pitches, slug, cycleSlug]
  )
  useRegisterPalettePitches(palettePitches)

  const cards = derivePitchCards(pitches, scopes, tasks, updates)
  // Group into a section per squad (Unassigned last); each section is sorted
  // by stage progression inside groupBySquad.
  const sections = groupBySquad(cards, squads)
  const today = getTeamToday(new Date())

  return (
    <MissionControlView
      slug={slug}
      cycleSlug={cycleSlug}
      cycleTitle={cycleTitle}
      today={today}
      sections={sections}
      onCreatePitch={onCreatePitch}
      cycleStart={cycle.start_date}
      cycleEnd={cycle.end_date}
    />
  )
}
