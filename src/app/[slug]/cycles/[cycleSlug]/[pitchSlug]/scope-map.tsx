'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import { ScopeMapSkeleton } from '@/components/scope-map'
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
import { buildUpdate } from '@/lib/update-engine'
import { computeTimebox } from '@/lib/timebox-engine'
import type { SlackMessageParams } from '@/lib/slack-message'
import { useOrganizationUsers } from '@/components/organization-users-context'
import type { Stage, Zone, PitchUpdate, CycleScope, ScopeTask } from '@/cycle-liveblocks.config'
import { LiveObject } from '@liveblocks/client'
import { nanoid } from 'nanoid'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSlackEnabled } from '@/components/slack-config-context'
import { slugify } from '@/lib/slugify'
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
          <ClientSideSuspense fallback={<ScopeMapSkeleton />}>
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
  const slackEnabled = useSlackEnabled()
  const pitch = useCycleStorage((root) => {
    const bySlug = root.pitches.find(
      (p) =>
        p.id === pitchSlug ||
        slugify(p.title) === pitchSlug
    )
    return bySlug ?? null
  })
  const allScopes = useCycleStorage((root) => [...root.scopes])
  const allTasks = useCycleStorage((root) => [...root.tasks])
  const allUpdates = useCycleStorage((root) => [...root.updates])
  const allParkingItems = useCycleStorage((root) => [...root.parkingItems])
  const cycle = useCycleStorage((root) => ({
    start_date: root.cycle.start_date,
    end_date: root.cycle.end_date,
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

  const onAddTask = useCycleMutation(
    ({ storage }, scopeId: string, title: string) => {
      const task: ScopeTask = { id: nanoid(), scopeId, title, done: false }
      storage.get('tasks').push(new LiveObject(task))
    },
    []
  )

  const onAddScope = useCycleMutation(
    ({ storage }, title: string, tier: string) => {
      const scope: CycleScope = {
        id: nanoid(),
        pitchId,
        title,
        tier: tier as CycleScope['tier'],
        litmus_text: '',
        hill_progress: 0,
      }
      storage.get('scopes').push(new LiveObject(scope))
    },
    [pitchId]
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

  const onEditScope = useCycleMutation(
    ({ storage }, scopeId: string, newTitle: string, newTier: string) => {
      const scope = storage.get('scopes').find((s) => s.get('id') === scopeId)
      if (!scope) return
      scope.set('title', newTitle)
      scope.set('tier', newTier as CycleScope['tier'])
    },
    []
  )

  const onDeleteScope = useCycleMutation(
    ({ storage }, scopeId: string) => {
      const tasksList = storage.get('tasks')
      for (let i = tasksList.length - 1; i >= 0; i--) {
        if (tasksList.get(i)!.get('scopeId') === scopeId) {
          tasksList.delete(i)
        }
      }
      const scopesList = storage.get('scopes')
      for (let i = scopesList.length - 1; i >= 0; i--) {
        if (scopesList.get(i)!.get('id') === scopeId) {
          scopesList.delete(i)
          break
        }
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

  const pushUpdate = useCycleMutation(
    ({ storage }, built: PitchUpdate) => {
      storage.get('updates').push(new LiveObject(built))
      const p = storage.get('pitches').find((x) => x.get('id') === built.pitchId)
      if (p) p.set('needle', { progress: built.needle_snapshot.progress, zone: built.needle_snapshot.zone })
    },
    []
  )

  const markSlackAttempted = useCycleMutation(
    ({ storage }, updateId: string) => {
      const updates = storage.get('updates')
      for (let i = 0; i < updates.length; i++) {
        if (updates.get(i)!.get('id') === updateId) {
          updates.get(i)!.set('slack_attempted', true)
          break
        }
      }
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
      } catch (err) {
        console.warn('Slack delivery failed', err)
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
  const timebox = pitch
    ? computeTimebox(pitch.timebox_start, pitch.timebox_end, today)
    : null

  const pitchUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${slug}/cycles/${cycleSlug}/${pitchSlug}`
    : ''

  const userName = user?.firstName ?? usersMap.get(userId ?? '')?.name ?? 'You'

  const onPostUpdate = useCallback(
    async (zone: Zone, narrative: string) => {
      if (!pitch || !userId || !timebox) return
      const built = buildUpdate({
        pitchId,
        userId,
        zone,
        narrative,
        currentNeedle: pitch.needle,
        scopes: pitchScopes.map((s) => ({ id: s.id, hill_progress: s.hill_progress })),
        tasks: pitchTasks.map((t) => ({ scopeId: t.scopeId, done: t.done })),
        timebox: { daysLeft: timebox.daysLeft, currentWeek: timebox.currentWeek, totalWeeks: timebox.totalWeeks },
      })
      pushUpdate(built)
      if (!slackEnabled) return
      markSlackAttempted(built.id)
      await deliverToSlack(
        {
          pitchTitle: pitch.title,
          weekNumber: timebox.currentWeek,
          totalWeeks: timebox.totalWeeks,
          zone,
          narrative,
          tasksDone: totalProgress.done,
          tasksTotal: totalProgress.total,
          daysLeft: timebox.daysLeft,
          pitchUrl,
          postedAt: built.posted_at,
        },
        built.id
      )
    },
    [pushUpdate, markSlackAttempted, deliverToSlack, pitchId, userId, pitch, pitchScopes, pitchTasks, timebox, totalProgress, pitchUrl, slackEnabled]
  )

  const onRetrySlack = useCallback(
    async (updateId: string) => {
      if (!pitch) return
      const update = pitchUpdates.find((u) => u.id === updateId)
      if (!update) return
      const snapshotDone = update.task_snapshot.reduce((sum, s) => sum + s.done, 0)
      const snapshotTotal = update.task_snapshot.reduce((sum, s) => sum + s.total, 0)
      const tb = update.timebox_snapshot
      await deliverToSlack(
        {
          pitchTitle: pitch.title,
          weekNumber: tb.currentWeek,
          totalWeeks: tb.totalWeeks,
          zone: update.needle_snapshot.zone,
          narrative: update.narrative,
          tasksDone: snapshotDone,
          tasksTotal: snapshotTotal,
          daysLeft: tb.daysLeft,
          pitchUrl,
          postedAt: update.posted_at,
        },
        updateId
      )
    },
    [deliverToSlack, pitchUpdates, pitch, pitchUrl]
  )

  if (!pitch) {
    return (
      <main className="w-full max-w-screen-xl mx-auto px-6 py-8">
        <p className="text-sm text-muted-foreground">Pitch not found.</p>
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
      onAddTask={onAddTask}
      onAddScope={onAddScope}
      onEditScope={onEditScope}
      onDeleteScope={onDeleteScope}
      onScopeReorder={onScopeReorder}
      onScopeReset={onScopeReset}
      onParkingToggle={onParkingToggle}
      onPostUpdate={onPostUpdate}
      userName={userName}
      timelineCards={timelineCards}
      onRetrySlack={slackEnabled ? onRetrySlack : undefined}
    />
  )
}
