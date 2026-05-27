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
import type { Stage } from '@/cycle-liveblocks.config'

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

  if (!pitch) {
    return (
      <main className="mt-16 w-full max-w-screen-lg mx-auto px-6">
        <p className="text-muted-foreground">Pitch not found.</p>
      </main>
    )
  }

  const scopeGridItems = deriveScopeGridItems(allScopes, allTasks, pitchId)
  const hillScopes = deriveHillScopes(allScopes, pitchId)
  const parkingLotItems = deriveParkingLotItems(allParkingItems, pitchId)
  const totalProgress = deriveTotalTaskProgress(allScopes, allTasks, pitchId)
  const ghost = deriveGhost(allUpdates.filter((u) => u.pitchId === pitchId))
  const today = new Date().toISOString().slice(0, 10)

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
    />
  )
}
