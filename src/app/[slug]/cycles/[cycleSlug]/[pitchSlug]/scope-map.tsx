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
  buildHillHistoryFrames,
} from '@/lib/scope-map-helpers'
import { deriveGhost, needleAfterDeletingLatest } from '@/lib/needle-engine'
import { assignScopeColor, resolveScopeColors } from '@/lib/color-engine'
import { assignSquadColor, resolveSquadByName } from '@/lib/squad-engine'
import { diffHillTrail, noChangeStreaks, summarizeMovement } from '@/lib/hill-trail-engine'
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
import { useRegisterPalettePitches } from '@/components/command-palette/command-palette-context'
import { slugify } from '@/lib/slugify'
import { useCallback, useMemo } from 'react'

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
  const allPitches = useCycleStorage((root) => [...root.pitches])
  const allScopes = useCycleStorage((root) => [...root.scopes])
  const allTasks = useCycleStorage((root) => [...root.tasks])
  const allUpdates = useCycleStorage((root) => [...root.updates])
  const allParkingItems = useCycleStorage((root) => [...root.parkingItems])
  const squads = useCycleStorage((root) => [...root.squads])
  const cycle = useCycleStorage((root) => ({
    start_date: root.cycle.start_date,
    end_date: root.cycle.end_date,
  }))
  const orgUsers = useOrganizationUsers()

  const pitchId = pitch?.id ?? ''

  // Register this cycle's pitches into the command palette while we're in the room.
  const palettePitches = useMemo(
    () =>
      allPitches.map((p) => ({
        id: p.id,
        title: p.title,
        emoji: p.emoji ?? '',
        stage: p.stage,
        zone: p.needle?.zone ?? null,
        href: `/${slug}/cycles/${cycleSlug}/${slugify(p.title)}`,
      })),
    [allPitches, slug, cycleSlug]
  )
  useRegisterPalettePitches(palettePitches)

  const onStageChange = useCycleMutation(
    ({ storage }, newStage: Stage) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('stage', newStage)
    },
    [pitchId]
  )

  const onEmojiChange = useCycleMutation(
    ({ storage }, emoji: string) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('emoji', emoji)
    },
    [pitchId]
  )

  const onNotionUrlChange = useCycleMutation(
    ({ storage }, url: string) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('notion_url', url)
    },
    [pitchId]
  )

  // Assign a squad by name: reuse an existing squad (matched case-insensitively
  // via the shared engine) or create a fresh one with an auto-assigned color.
  const onAssignSquad = useCycleMutation(
    ({ storage }, name: string) => {
      const squadsList = storage.get('squads')
      const arr: { id: string; name: string; color: string }[] = []
      for (let i = 0; i < squadsList.length; i++) {
        const s = squadsList.get(i)!
        arr.push({ id: s.get('id'), name: s.get('name'), color: s.get('color') })
      }
      const existing = resolveSquadByName(arr, name)
      let squadId: string
      if (existing) {
        squadId = existing.id
      } else {
        const usedColors = arr.map((s) => s.color).filter(Boolean)
        squadId = nanoid()
        squadsList.push(
          new LiveObject({ id: squadId, name, color: assignSquadColor(usedColors) })
        )
      }
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('squadId', squadId)
    },
    [pitchId]
  )

  const onClearSquad = useCycleMutation(
    ({ storage }) => {
      const p = storage.get('pitches').find((x) => x.get('id') === pitchId)
      p?.set('squadId', undefined)
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

  const onTaskEdit = useCycleMutation(
    ({ storage }, _scopeId: string, taskId: string, title: string) => {
      const task = storage.get('tasks').find((t) => t.get('id') === taskId)
      task?.set('title', title)
    },
    []
  )

  const onTaskDelete = useCycleMutation(
    ({ storage }, _scopeId: string, taskId: string) => {
      const tasksList = storage.get('tasks')
      const idx = tasksList.findIndex((t) => t.get('id') === taskId)
      if (idx !== -1) tasksList.delete(idx)
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
    ({ storage }, title: string, tier: string, litmus_text: string) => {
      // Assign a unique identity color against the colors already in this pitch
      // (resolving any unset siblings first so we don't collide with them).
      const scopesList = storage.get('scopes')
      const siblings: { id: string; color?: string }[] = []
      for (let i = 0; i < scopesList.length; i++) {
        const s = scopesList.get(i)!
        if (s.get('pitchId') === pitchId) {
          siblings.push({ id: s.get('id'), color: s.get('color') })
        }
      }
      const usedColors = Object.values(resolveScopeColors(siblings))
      const scope: CycleScope = {
        id: nanoid(),
        pitchId,
        title,
        tier: tier as CycleScope['tier'],
        litmus_text,
        hill_progress: 0,
        color: assignScopeColor(usedColors),
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
    (
      { storage },
      scopeId: string,
      fields: {
        title?: string
        tier?: CycleScope['tier']
        litmus_text?: string
        color?: string
      }
    ) => {
      const scope = storage.get('scopes').find((s) => s.get('id') === scopeId)
      if (!scope) return
      if (fields.title !== undefined) scope.set('title', fields.title)
      if (fields.tier !== undefined) scope.set('tier', fields.tier)
      if (fields.litmus_text !== undefined)
        scope.set('litmus_text', fields.litmus_text)
      if (fields.color !== undefined) scope.set('color', fields.color)
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

  // Delete the latest update — the misfire-undo escape hatch (ADR 0006). The UI
  // only offers this on the newest card, so latest-only holds; we revert the
  // pitch's denormalized needle to the prior update's snapshot (or null). Live
  // scope hill positions are untouched; Ghost and Hill Trails rebase off the
  // now-latest update through pure derivation.
  const onDeleteUpdate = useCycleMutation(
    ({ storage }, updateId: string) => {
      const updates = storage.get('updates')
      const idx = updates.findIndex((u) => u.get('id') === updateId)
      if (idx === -1) return
      const targetPitchId = updates.get(idx)!.get('pitchId')

      const all: PitchUpdate[] = []
      for (let i = 0; i < updates.length; i++) {
        const u = updates.get(i)!
        all.push({
          id: u.get('id'),
          pitchId: u.get('pitchId'),
          posted_at: u.get('posted_at'),
          needle_snapshot: u.get('needle_snapshot'),
        } as PitchUpdate)
      }
      const reverted = needleAfterDeletingLatest(all, targetPitchId, updateId)

      updates.delete(idx)
      const p = storage.get('pitches').find((x) => x.get('id') === targetPitchId)
      if (p) p.set('needle', reverted)
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
        } else {
          const body = await res.text()
          console.warn(`Slack delivery failed (${res.status})`, body)
        }
      } catch (err) {
        console.warn('Slack delivery failed', err)
      }
    },
    [markSlackDelivered]
  )

  const usersMap = useMemo(
    () =>
      new Map(
        (orgUsers ?? []).map((u) => [u.userId, { name: u.name, initials: u.initials }])
      ),
    [orgUsers]
  )

  const scopeGridItems = deriveScopeGridItems(allScopes, allTasks, pitchId)
  const hillScopes = deriveHillScopes(allScopes, pitchId)
  const parkingLotItems = deriveParkingLotItems(allParkingItems, pitchId)
  const totalProgress = deriveTotalTaskProgress(allScopes, allTasks, pitchId)
  const pitchUpdates = allUpdates.filter((u) => u.pitchId === pitchId)
  const ghost = deriveGhost(pitchUpdates)
  const latestUpdate = pitchUpdates.length
    ? pitchUpdates.reduce((a, b) => (a.posted_at > b.posted_at ? a : b))
    : null
  // The "before" snapshot. On the first-ever update there's no prior one, so
  // baseline every scope at 0% — the first move still gets a before/after diff
  // (everything starting from the foot of the hill).
  const baselineSnapshot = latestUpdate
    ? latestUpdate.hill_snapshot
    : hillScopes.map((s) => ({
        scopeId: s.id,
        hill_progress: 0,
        title: s.title,
        tier: s.tier,
      }))
  const hillTrails = hillScopes.length
    ? diffHillTrail(baselineSnapshot, hillScopes)
    : []
  // Zone delta and hill movement are framed against the previous update; both
  // feed the Slack message and its live preview, so derive them once here.
  const previousZone = latestUpdate?.needle_snapshot.zone ?? null
  const snapshotsNewestFirst = [...pitchUpdates]
    .sort((a, b) => (a.posted_at > b.posted_at ? -1 : 1))
    .map((u) => u.hill_snapshot)
  const movement = summarizeMovement(
    hillTrails,
    noChangeStreaks(snapshotsNewestFirst, hillScopes),
    new Map(hillScopes.map((s) => [s.id, s.title]))
  )
  // "Before" scopes for the modal's before/after comparison — the last update's
  // positions, or the 0% baseline on the first move.
  const liveColorById = new Map(hillScopes.map((s) => [s.id, s.color]))
  const previousHillScopes = baselineSnapshot.map((h, i) => ({
    id: h.scopeId,
    title: h.title ?? '',
    tier: h.tier ?? ('should' as const),
    hill_progress: h.hill_progress,
    order: i + 1,
    color: liveColorById.get(h.scopeId) ?? '#9ca3af',
  }))
  const hillHistory = buildHillHistoryFrames(pitchUpdates, hillScopes, usersMap)
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
    async (progress: number, zone: Zone, narrative: string) => {
      if (!pitch || !userId || !timebox) return
      const built = buildUpdate({
        pitchId,
        userId,
        progress,
        zone,
        narrative,
        currentNeedle: pitch.needle,
        scopes: pitchScopes.map((s) => ({ id: s.id, hill_progress: s.hill_progress, title: s.title, tier: s.tier })),
        tasks: pitchTasks.map((t) => ({ scopeId: t.scopeId, done: t.done })),
        timebox: { daysLeft: timebox.daysLeft, currentWeek: timebox.currentWeek, totalWeeks: timebox.totalWeeks },
      })
      pushUpdate(built)
      if (!slackEnabled) return
      markSlackAttempted(built.id)
      await deliverToSlack(
        {
          pitchTitle: pitch.title,
          pitchEmoji: pitch.emoji ?? '',
          weekNumber: timebox.currentWeek,
          totalWeeks: timebox.totalWeeks,
          zone,
          previousZone,
          authorName: userName,
          narrative,
          movement,
          needleProgress: progress,
          previousNeedleProgress: pitch.needle?.progress ?? null,
          daysLeft: timebox.daysLeft,
          pitchUrl,
          postedAt: built.posted_at,
        },
        built.id
      )
    },
    [pushUpdate, markSlackAttempted, deliverToSlack, pitchId, userId, pitch, pitchScopes, pitchTasks, timebox, pitchUrl, slackEnabled, previousZone, movement, userName]
  )

  const onRetrySlack = useCallback(
    async (updateId: string) => {
      if (!pitch) return
      // Reconstruct the message exactly as it would have read when first posted:
      // ordered by post time, the prior update supplies the zone delta and the
      // hill diff, and earlier snapshots supply the no-change streaks.
      const ordered = [...pitchUpdates].sort((a, b) =>
        a.posted_at < b.posted_at ? -1 : 1
      )
      const idx = ordered.findIndex((u) => u.id === updateId)
      if (idx === -1) return
      const update = ordered[idx]
      const prev = idx > 0 ? ordered[idx - 1] : null
      const tb = update.timebox_snapshot

      const scopesAtPost = update.hill_snapshot.map((h) => ({
        id: h.scopeId,
        hill_progress: h.hill_progress,
      }))
      let movement: string | null = null
      if (prev) {
        const trails = diffHillTrail(prev.hill_snapshot, scopesAtPost)
        const priorSnapshots = ordered.slice(0, idx).map((u) => u.hill_snapshot).reverse()
        const streaks = noChangeStreaks(priorSnapshots, scopesAtPost)
        const titles = new Map(update.hill_snapshot.map((h) => [h.scopeId, h.title ?? h.scopeId]))
        movement = summarizeMovement(trails, streaks, titles)
      }

      await deliverToSlack(
        {
          pitchTitle: pitch.title,
          pitchEmoji: pitch.emoji ?? '',
          weekNumber: tb.currentWeek,
          totalWeeks: tb.totalWeeks,
          zone: update.needle_snapshot.zone,
          previousZone: prev?.needle_snapshot.zone ?? null,
          authorName: usersMap.get(update.posted_by)?.name ?? 'Teammate',
          narrative: update.narrative,
          movement,
          needleProgress: update.needle_snapshot.progress,
          previousNeedleProgress: prev?.needle_snapshot.progress ?? null,
          daysLeft: tb.daysLeft,
          pitchUrl,
          postedAt: update.posted_at,
        },
        updateId
      )
    },
    [deliverToSlack, pitchUpdates, pitch, pitchUrl, usersMap]
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
      pitch={{
        ...pitch,
        emoji: pitch.emoji ?? '',
        notion_url: pitch.notion_url ?? '',
      }}
      squads={squads}
      currentSquadId={pitch.squadId}
      onAssignSquad={onAssignSquad}
      onClearSquad={onClearSquad}
      hillScopes={hillScopes}
      hillTrails={hillTrails}
      hillHistory={hillHistory}
      scopeGridItems={scopeGridItems}
      parkingLotItems={parkingLotItems}
      totalProgress={totalProgress}
      ghost={ghost}
      today={today}
      onStageChange={onStageChange}
      onEmojiChange={onEmojiChange}
      onNotionUrlChange={onNotionUrlChange}
      onHillProgressChange={onHillProgressChange}
      onTaskToggle={onTaskToggle}
      onTaskEdit={onTaskEdit}
      onTaskDelete={onTaskDelete}
      onAddTask={onAddTask}
      onAddScope={onAddScope}
      onEditScope={onEditScope}
      onDeleteScope={onDeleteScope}
      onScopeReorder={onScopeReorder}
      onScopeReset={onScopeReset}
      onParkingToggle={onParkingToggle}
      onPostUpdate={onPostUpdate}
      userName={userName}
      previousZone={previousZone}
      previousNeedleProgress={pitch.needle?.progress ?? null}
      previousHillScopes={previousHillScopes}
      movementPreview={movement}
      timelineCards={timelineCards}
      onRetrySlack={slackEnabled ? onRetrySlack : undefined}
      onDeleteUpdate={onDeleteUpdate}
    />
  )
}
