'use client'

import { useEffect } from 'react'
import { ClientSideSuspense } from '@liveblocks/react'
import {
  ProductMapRoomProvider,
  productMapInitialStorage,
  useProductMapStorage,
} from '@/product-map-room-context'
import type { Area, Frame } from '@/product-map-liveblocks.config'
import {
  descendantPins,
  flattenAreas,
  renderProductMap,
  type CycleWindow,
  type LinkedShape,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { freshnessOf } from '@/lib/frame-list'
import { getTeamToday } from '@/lib/team-time'
import type { OrganizationUser } from '@/lib/users'
import { OrganizationUsersProvider, useMember } from '@/components/organization-users-context'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { FileInto, areaOptions } from '../../product-map'
import { FilteredFrames } from '../../frame-filters'
import { MapWorkspace, WorkspaceSkeleton } from '../../map-workspace'
import { AreaCrumb, Crumbs } from '../../crumbs'
import { ChevronRight } from 'lucide-react'
import { Missing } from '../../missing'
import { UNMAPPED_AREA, useOpenFramePage } from '../../links'
import { TopBar } from '@/components/sidebar-layout'

/**
 * One area on a page of its own: its land, its sub-areas and every frame under
 * it as a filterable list. The breadcrumb on a frame page links here.
 */
export function AreaPage({
  roomId,
  areaId,
  organizationUsers,
  cycles,
  shapes,
}: {
  roomId: string
  areaId: string
  organizationUsers: OrganizationUser[]
  cycles: CycleWindow[]
  shapes: LinkedShape[]
}) {
  return (
    <OrganizationUsersProvider organizationUsers={organizationUsers}>
      <ProductMapRoomProvider
        id={roomId}
        initialPresence={{}}
        initialStorage={productMapInitialStorage()}
      >
        <ClientSideSuspense
          fallback={
            areaId === UNMAPPED_AREA ? <UnmappedSkeleton /> : <WorkspaceSkeleton withHeading />
          }
        >
          {() => <AreaPageView areaId={areaId} cycles={cycles} shapes={shapes} />}
        </ClientSideSuspense>
      </ProductMapRoomProvider>
    </OrganizationUsersProvider>
  )
}

function AreaPageView(props: { areaId: string; cycles: CycleWindow[]; shapes: LinkedShape[] }) {
  // Guarded reads: a room whose root predates either list must still render.
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])
  return <AreaLayout {...props} frames={frames} areas={areas} editable />
}

/**
 * The page from plain data, so the e2e route can draw it from a fixture.
 * `editable` adds filing on the Unmapped page, which needs the room.
 */
export function AreaLayout({
  areaId,
  frames,
  areas,
  cycles,
  shapes,
  editable = false,
}: {
  areaId: string
  frames: Frame[]
  areas: Area[]
  cycles: CycleWindow[]
  shapes: LinkedShape[]
  editable?: boolean
}) {
  const openFrame = useOpenFramePage()
  const model = renderProductMap({
    areas,
    frames,
    cycles,
    shapes,
    today: getTeamToday(new Date()),
  })
  const options = areaOptions(model.areas)
  const unmapped = areaId === UNMAPPED_AREA
  const area = unmapped
    ? null
    : flattenAreas(model.areas).find((a) => a.area.areaId === areaId)?.area
  const name = unmapped ? 'Unmapped' : area?.name

  useEffect(() => {
    if (name) document.title = `${name} | Cycles`
  }, [name])

  if (!unmapped && !area) return <Missing what="area" />

  // A resolved frame is off the map and still on record here (ADR 0025); the
  // list hides it until somebody filters for it.
  const pins = area
    ? [...descendantPins(area), ...resolvedUnder(area)]
    : [...model.unmapped, ...model.unmappedResolved]
  const open = pins.filter((p) => p.state !== 'resolved')

  // An area with land is a map of its own, the same workspace as the Product Map.
  if (area) {
    return (
      <MapWorkspace
        title={
          <div className="flex min-w-0 items-center gap-1.5">
            <Crumbs areas={areas} areaId={areaId} trailing={false} />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-50" />
            <AreaCrumb areas={areas} areaId={areaId} current />
          </div>
        }
        heading={
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-2xl">{name}</h1>
            <Stats pins={open} owner={area.owner} />
          </div>
        }
        areas={[area]}
        pins={pins}
        onOpenFrame={openFrame}
      />
    )
  }

  // Unmapped has no land, so its page is the list, with filing on every row.
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-8">
      <TopBar title={<Crumbs areas={areas} areaId="" />} />
      {/* The same title row as an area with land: the name, then its stats. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-2xl">{name}</h1>
          <Stats pins={open} owner={null} />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The holding area for frames that belong to no area yet. Leaving one here is always valid.
          File a frame into an area from its row.
        </p>
      </div>
      <FilteredFrames
        pins={pins}
        areas={[]}
        action={editable ? (pin) => <FileInto pin={pin} options={options} /> : undefined}
      />
    </main>
  )
}

function Stats({ pins, owner }: { pins: RenderedPin[]; owner: string | null }) {
  const member = useMember(owner)
  const customers = new Set(
    pins.flatMap((p) => p.reports.filter((r) => r.customer).map((r) => r.customer)),
  )
  const hot = pins.filter((p) => freshnessOf(p.opacity) === 'top_of_mind').length
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span>
        {pins.length} open {pins.length === 1 ? 'frame' : 'frames'}
      </span>
      <span>{hot} top of mind</span>
      <span>
        {customers.size} {customers.size === 1 ? 'customer' : 'customers'} reported
      </span>
      {member && (
        <span
          className="flex items-center gap-1.5"
          title="The owner a new frame here gets by default"
        >
          Area owner: <UserAvatar user={member} /> {member.name}
        </span>
      )}
    </p>
  )
}

function resolvedUnder(area: RenderedArea): RenderedPin[] {
  return [...area.resolved, ...area.children.flatMap(resolvedUnder)]
}

/** Unmapped has no land, so it loads as its list does: a title row, filters, rows. */
function UnmappedSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-8" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col divide-y rounded-lg border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-7 w-36" />
          </div>
        ))}
      </div>
    </main>
  )
}
