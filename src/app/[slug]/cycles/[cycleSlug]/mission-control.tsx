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
import { EditCycleButton } from './edit-cycle-dialog'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSlackEnabled } from '@/components/slack-config-context'
import { derivePitchCards, groupBySquad } from '@/lib/mission-control-helpers'
import { useRegisterPalettePitches } from '@/components/command-palette/command-palette-context'
import { slugify } from '@/lib/slugify'
import { getTeamToday } from '@/lib/team-time'
import { useMemo } from 'react'
import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/client'
import type { OverlayBand } from '@/lib/calendar/ics-normalizer'

type MissionControlProps = {
  roomId: string
  cycleSlug: string
  cycleTitle: string
  slug: string
  organizationUsers: OrganizationUser[]
  /** Calendar overlay bands fetched server-side (ADR 0014). */
  cycleBands?: OverlayBand[]
  /** Chronological neighbors for the cycle stepper. */
  prevCycleSlug?: string
  prevCycleTitle?: string
  nextCycleSlug?: string
  nextCycleTitle?: string
}

export function MissionControl({
  roomId,
  cycleSlug,
  cycleTitle,
  slug,
  organizationUsers,
  cycleBands,
  prevCycleSlug,
  prevCycleTitle,
  nextCycleSlug,
  nextCycleTitle,
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
              cycleBands={cycleBands}
              prevCycleSlug={prevCycleSlug}
              prevCycleTitle={prevCycleTitle}
              nextCycleSlug={nextCycleSlug}
              nextCycleTitle={nextCycleTitle}
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
  cycleBands,
  prevCycleSlug,
  prevCycleTitle,
  nextCycleSlug,
  nextCycleTitle,
}: {
  cycleSlug: string
  cycleTitle: string
  slug: string
  cycleBands?: OverlayBand[]
  prevCycleSlug?: string
  prevCycleTitle?: string
  nextCycleSlug?: string
  nextCycleTitle?: string
}) {
  const pitches = useCycleStorage((root) => [...root.pitches])
  const scopes = useCycleStorage((root) => [...root.scopes])
  const tasks = useCycleStorage((root) => [...root.tasks])
  const updates = useCycleStorage((root) => [...root.updates])
  const squads = useCycleStorage((root) => [...root.squads])

  const cycle = useCycleStorage((root) => ({
    name: root.cycle.name,
    type: root.cycle.type,
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
      cycleType={cycle.type}
      today={today}
      sections={sections}
      onCreatePitch={onCreatePitch}
      cycleStart={cycle.start_date}
      cycleEnd={cycle.end_date}
      cycleBands={cycleBands}
      cycleNav={
        <CycleStepper
          slug={slug}
          prevSlug={prevCycleSlug}
          prevTitle={prevCycleTitle}
          nextSlug={nextCycleSlug}
          nextTitle={nextCycleTitle}
        />
      }
      headerActions={
        <EditCycleButton
          cycleSlug={cycleSlug}
          name={cycle.name}
          type={cycle.type}
          start_date={cycle.start_date}
          end_date={cycle.end_date}
        />
      }
    />
  )
}


/** Prev/next cycle stepper, ordered chronologically (see cycleNeighbors). */
function CycleStepper({
  slug,
  prevSlug,
  prevTitle,
  nextSlug,
  nextTitle,
}: {
  slug: string
  prevSlug?: string
  prevTitle?: string
  nextSlug?: string
  nextTitle?: string
}) {
  const base =
    'flex items-center justify-center h-7 w-7 rounded-lg border transition-colors'
  return (
    <div className="flex items-center gap-1">
      {prevSlug ? (
        <Link
          href={`/${slug}/cycles/${prevSlug}`}
          title={prevTitle ? `Previous cycle · ${prevTitle}` : 'Previous cycle'}
          aria-label="Previous cycle"
          className={cn(base, 'hover:bg-muted')}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
      ) : (
        <span aria-disabled className={cn(base, 'opacity-30 cursor-not-allowed')}>
          <ChevronLeft className="w-4 h-4" />
        </span>
      )}
      {nextSlug ? (
        <Link
          href={`/${slug}/cycles/${nextSlug}`}
          title={nextTitle ? `Next cycle · ${nextTitle}` : 'Next cycle'}
          aria-label="Next cycle"
          className={cn(base, 'hover:bg-muted')}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span aria-disabled className={cn(base, 'opacity-30 cursor-not-allowed')}>
          <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </div>
  )
}
