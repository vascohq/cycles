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
import { TooltipProvider } from '@/components/ui/tooltip'
import { ScopeMapView } from '@/components/scope-map'
import {
  deriveScopeGridItems,
  deriveHillScopes,
  deriveParkingLotItems,
  deriveTotalTaskProgress,
} from '@/lib/scope-map-helpers'
import { deriveGhost } from '@/lib/needle-engine'
import { deriveTimelineCards } from '@/lib/timeline-helpers'
import { buildUpdate, weekOfTimebox } from '@/lib/update-engine'
import type { SlackMessageParams } from '@/lib/slack-message'
import { useOrganizationUsers } from '@/components/organization-users-context'
import type { Stage, Zone } from '@/cycle-liveblocks.config'
import { LiveObject } from '@liveblocks/client'
import { useAuth, useUser } from '@clerk/nextjs'
import { useCallback } from 'react'

type ScopeMapProps = {
  roomId: string
  pitchSlug: string
  cycleSlug: string
  cycleTitle: string
  slug: string
  organizationUsers: OrganizationUser[]
}

export function ScopeMap({
  roomId,
  pitchSlug,
  cycleSlug,
  cycleTitle,
  slug,
  organizationUsers,
}: ScopeMapProps) {
  return (
    <TooltipProvider>
      <OrganizationUsersProvider organizationUsers={organizationUsers}>
        <CycleRoomProvider
          id={roomId}
          initialPresence={{}}
          initialStorage={cycleInitialStorage()}
        >
          <ClientSideSuspense
            fallback={
              <main className="mt-16 w-full max-w-screen-lg mx-auto px-6">
                Loading…
              </main>
            }
          >
            {() => (
              <ScopeMapWired
                pitchSlug={pitchSlug}
                cycleSlug={cycleSlug}
                cycleTitle={cycleTitle}
                slug={slug}
              />
            )}
          </ClientSideSuspense>
        </CycleRoomProvider>
      </OrganizationUsersProvider>
    </TooltipProvider>
  )
}

function ScopeMapWired({
  pitchSlug,
  cycleSlug,
  cycleTitle,
  slug,
}: {
  pitchSlug: string
  cycleSlug: string
  cycleTitle: string
  slug: string
}) {
  const { userId } = useAuth()
  const { user } = useUser()
  const pitch = useCycleStorage((root) => {
    const bySlug = root.pitches.find(
      (p) =>
        p.id === pitchSlug ||
        p.title.toLowerCase().replace(/\s+/g, '-') === pitchSlug
    )
    return bySlug ?? root.pitches[0] ?? null
  })
  const allScopes = useCycleStorage((root) => [...root.scopes])
  const allTasks = useCycleStorage((root) => [...root.tasks])
  const allUpdates = useCycleStorage((root) => [...root.updates])
  const allParkingItems = useCycleStorage((root) => [...root.parkingItems])
  const cycle = useCycleStorage((root) => ({
    start_date: root.cycle.start_date,
    end_date: root.cycle.end_date,
    slack_channel: root.cycle.slack_channel,
  }))
  const orgUsers = useOrganizationUsers()

  const pitchId = pitch?.id ?? ''

  const onStageChange = useCycleMutation(
    ({ storage }, newStage: Stage) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('stage', newStage)
    },
    [pitchId]
  )

  const onNeedleProgressChange = useCycleMutation(
    ({ storage }, progress: number) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      if (!p) return
      const needle = p.get('needle')
      if (needle) p.set('needle', { ...needle, progress })
    },
    [pitchId]
  )

  const onHillProgressChange = useCycleMutation(
    ({ storage }, scopeId: string, progress: number) => {
      const scope = storage.get('scopes').find((s) => s.get('id') === scopeId)
      scope?.set('hill_progress', progress)
    },
    []
  )

  const onTaskToggle = useCycleMutation(
    ({ storage }, _scopeId: string, taskId: string, done: boolean) => {
      const task = storage.get('tasks').find((t) => t.get('id') === taskId)
      task?.set('done', done)
    },
    []
  )

  const onScopeReorder = useCycleMutation(
    ({ storage }, activeId: string, overId: string) => {
      const scopesList = storage.get('scopes')
      const pitchScopes: { index: number }[] = []
      for (let i = 0; i < scopesList.length; i++) {
        if (scopesList.get(i)!.get('pitchId') === pitchId) {
          pitchScopes.push({ index: i })
        }
      }
      const activeIdx = pitchScopes.findIndex(
        (_, idx) =>
          scopesList.get(pitchScopes[idx].index)!.get('id') === activeId
      )
      const overIdx = pitchScopes.findIndex(
        (_, idx) =>
          scopesList.get(pitchScopes[idx].index)!.get('id') === overId
      )
      if (activeIdx === -1 || overIdx === -1) return
      scopesList.move(pitchScopes[activeIdx].index, pitchScopes[overIdx].index)
    },
    [pitchId]
  )

  const onScopeReset = useCycleMutation(
    ({ storage }, scopeId: string) => {
      const tasksList = storage.get('tasks')
      for (let i = 0; i < tasksList.length; i++) {
        const task = tasksList.get(i)!
        if (task.get('scopeId') === scopeId) task.set('done', false)
      }
    },
    []
  )

  const onParkingToggle = useCycleMutation(
    ({ storage }, itemId: string, resolved: boolean) => {
      const item = storage
        .get('parkingItems')
        .find((i) => i.get('id') === itemId)
      item?.set('resolved', resolved)
    },
    []
  )

  const persistUpdate = useCycleMutation(
    ({ storage }, update: Parameters<typeof buildUpdate>[0]) => {
      const built = buildUpdate(update)
      storage.get('updates').push(new LiveObject(built))
      const p = storage.get('pitches').find((x) => x.get('id') === update.pitchId)
      if (p) p.set('needle', { progress: built.needle_snapshot.progress, zone: built.needle_snapshot.zone })
      return built
    },
    []
  )

  const markSlackDelivered = useCycleMutation(
    ({ storage }, updateId: string, deliveredAt: string) => {
      const updates = storage.get('updates')
      for (let i = 0; i < updates.length; i++) {
        if (updates.get(i)!.get('id') === updateId) {
          updates.get(i)!.set('slack_delivered_at', deliveredAt)
          break
        }
      }
    },
    []
  )

  const deliverToSlack = useCallback(
    async (params: SlackMessageParams, updateId: string) => {
      try {
        const res = await fetch('/api/slack/post-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        if (res.ok) {
          const { delivered_at } = (await res.json()) as { delivered_at: string }
          markSlackDelivered(updateId, delivered_at)
        }
      } catch {
        // Slack delivery failed — retry banner will show
      }
    },
    [markSlackDelivered]
  )

  const usersMap = new Map(
    (orgUsers ?? []).map((u) => [u.userId, { name: u.name, initials: u.initials }])
  )

  const scopeGridItems = deriveScopeGridItems(allScopes, allTasks, pitchId)
  const hillScopes = deriveHillScopes(allScopes, pitchId)
  const parkingLotItems = deriveParkingLotItems(allParkingItems, pitchId)
  const totalProgress = deriveTotalTaskProgress(allScopes, allTasks, pitchId)
  const pitchUpdates = allUpdates.filter((u) => u.pitchId === pitchId)
  const ghost = deriveGhost(pitchUpdates)
  const timelineCards = deriveTimelineCards(pitchUpdates, usersMap)
  const today = new Date().toISOString().slice(0, 10)

  const pitchScopes = allScopes.filter((s) => s.pitchId === pitchId)
  const pitchTasks = allTasks.filter((t) => pitchScopes.some((s) => s.id === t.scopeId))
  const currentWeek = pitch ? weekOfTimebox(pitch.timebox_start, pitch.timebox_end, today) : 1
  const totalDays = pitch
    ? Math.round(
        (new Date(pitch.timebox_end + 'T00:00:00').getTime() -
          new Date(pitch.timebox_start + 'T00:00:00').getTime()) /
          86_400_000
      )
    : 42
  const totalWeeks = Math.ceil(totalDays / 7)
  const elapsedDays = pitch
    ? Math.round(
        (new Date(today + 'T00:00:00').getTime() -
          new Date(pitch.timebox_start + 'T00:00:00').getTime()) /
          86_400_000
      )
    : 0
  const daysLeft = Math.max(0, totalDays - elapsedDays)

  const pitchUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${slug}/cycles/${cycleSlug}/${pitchSlug}`
    : ''

  const userName = user?.firstName ?? usersMap.get(userId ?? '')?.name ?? 'You'
  const channelName = cycle.slack_channel || 'general'

  const onPostUpdate = useCallback(
    async (zone: Zone, narrative: string) => {
      if (!pitch || !userId) return
      const built = persistUpdate({
        pitchId,
        userId,
        zone,
        narrative,
        currentNeedle: pitch.needle,
        scopes: pitchScopes.map((s) => ({ id: s.id, hill_progress: s.hill_progress })),
        tasks: pitchTasks.map((t) => ({ scopeId: t.scopeId, done: t.done })),
      })
      if (built) {
        await deliverToSlack(
          {
            pitchTitle: pitch.title,
            weekNumber: currentWeek,
            totalWeeks,
            zone,
            narrative,
            tasksDone: totalProgress.done,
            tasksTotal: totalProgress.total,
            daysLeft,
            pitchUrl,
            postedAt: built.posted_at,
          },
          built.id
        )
      }
    },
    [persistUpdate, deliverToSlack, pitchId, userId, pitch, pitchScopes, pitchTasks, currentWeek, totalWeeks, totalProgress, daysLeft, pitchUrl]
  )

  const onRetrySlack = useCallback(
    async (updateId: string) => {
      if (!pitch) return
      const update = pitchUpdates.find((u) => u.id === updateId)
      if (!update) return
      await deliverToSlack(
        {
          pitchTitle: pitch.title,
          weekNumber: currentWeek,
          totalWeeks,
          zone: update.needle_snapshot.zone,
          narrative: update.narrative,
          tasksDone: totalProgress.done,
          tasksTotal: totalProgress.total,
          daysLeft,
          pitchUrl,
          postedAt: update.posted_at,
        },
        updateId
      )
    },
    [deliverToSlack, pitchUpdates, pitch, currentWeek, totalWeeks, totalProgress, daysLeft, pitchUrl]
  )

  if (!pitch) {
    return (
      <main className="mt-16 w-full max-w-screen-lg mx-auto px-6">
        <p className="text-muted-foreground">Pitch not found.</p>
      </main>
    )
  }

  return (
    <ScopeMapView
      slug={slug}
      cycleSlug={cycleSlug}
      cycleTitle={cycleTitle}
      pitch={pitch}
      hillScopes={hillScopes}
      scopeGridItems={scopeGridItems}
      parkingLotItems={parkingLotItems}
      totalProgress={totalProgress}
      ghost={ghost}
      today={today}
      onStageChange={onStageChange}
      onNeedleProgressChange={onNeedleProgressChange}
      onHillProgressChange={onHillProgressChange}
      onTaskToggle={onTaskToggle}
      onScopeReorder={onScopeReorder}
      onScopeReset={onScopeReset}
      onParkingToggle={onParkingToggle}
      onPostUpdate={onPostUpdate}
      userName={userName}
      channelName={channelName}
      timelineCards={timelineCards}
      onRetrySlack={onRetrySlack}
    />
  )
}
