'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ClientSideSuspense } from '@liveblocks/react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import {
  ProductMapRoomProvider,
  productMapInitialStorage,
  useProductMapStorage,
} from '@/product-map-room-context'
import type { Area, Frame } from '@/product-map-liveblocks.config'
import {
  descendantPins,
  renderProductMap,
  type CycleWindow,
  type LinkedShape,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { freshnessOf } from '@/lib/frame-list'
import { getTeamToday } from '@/lib/team-time'
import type { OrganizationUser } from '@/lib/users'
import {
  OrganizationUsersProvider,
  useOrganizationUsers,
} from '@/components/organization-users-context'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import { MapCanvas } from '@/components/product-map/map-canvas'
import { Skeleton } from '@/components/ui/skeleton'
import { FileInto, areaOptions, useOpenFramePage } from '../../product-map'
import { AreaChip, FrameList } from '../../frame-list'
import { UNMAPPED_AREA, areaHref } from '../../links'

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
        <ClientSideSuspense fallback={<AreaPageSkeleton />}>
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
  const area = unmapped ? null : flatten(model.areas).find((a) => a.areaId === areaId)
  const name = unmapped ? 'Unmapped' : area?.name

  useEffect(() => {
    if (name) document.title = `${name} | Cycles`
  }, [name])

  if (!unmapped && !area) return <NoArea />

  // A resolved frame is off the map and still on record here (ADR 0025); the
  // list hides it until somebody filters for it.
  const pins = area
    ? [...descendantPins(area), ...resolvedUnder(area)]
    : [...model.unmapped, ...model.unmappedResolved]
  const open = pins.filter((p) => p.state !== 'resolved')

  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-6">
      <Crumbs areas={areas} areaId={unmapped ? '' : areaId} trailing={false} />
      {/* The same container and hero card as the Scope Map. */}
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <h1 className="font-display text-3xl leading-tight">{name}</h1>
        <Stats pins={open} owner={area?.owner ?? null} />
        {unmapped && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            The holding area for frames that belong to no area yet. Leaving one here is always
            valid. File a frame into an area from its row.
          </p>
        )}
        {area && area.children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {area.children.map((child) => (
              <AreaChip
                key={child.areaId}
                areaId={child.areaId}
                name={child.name}
                count={descendantPins(child).length}
              />
            ))}
          </div>
        )}
      </section>

      {area && <MapCanvas areas={[area]} onOpenFrame={openFrame} />}
      <FrameList
        pins={pins}
        areas={area ? [area] : []}
        action={
          unmapped && editable ? (pin) => <FileInto pin={pin} options={options} /> : undefined
        }
      />
    </main>
  )
}

function Stats({ pins, owner }: { pins: RenderedPin[]; owner: string | null }) {
  const users = useOrganizationUsers()
  const member = owner ? users.find((u) => u.userId === owner) : undefined
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

/** The areas an area or a frame sits in, outermost first. */
export function areaPath(areas: Area[], areaId: string): Area[] {
  const path: Area[] = []
  const seen = new Set<string>()
  let area = areas.find((a) => a.id === areaId)
  // `seen` guards a parent loop an agent could write; the map draws one too.
  while (area && !seen.has(area.id)) {
    seen.add(area.id)
    path.unshift(area)
    const parentId = area.parentAreaId
    area = areas.find((a) => a.id === parentId)
  }
  return path
}

/**
 * Product Map › region › … › area. Every part links to its page. On an area
 * page the last part is the page itself, so `trailing={false}` drops it.
 */
export function Crumbs({
  areas,
  areaId,
  trailing = true,
}: {
  areas: Area[]
  areaId: string
  trailing?: boolean
}) {
  const { slug } = useParams<{ slug: string }>()
  const path = areaPath(areas, areaId)
  const crumbs = path.length
    ? path.map((a) => ({ id: a.id, name: a.name }))
    : [{ id: UNMAPPED_AREA, name: 'Unmapped' }]
  const shown = trailing ? crumbs : crumbs.slice(0, -1)
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link
        href={`/${slug}/product`}
        className="flex shrink-0 items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Product Map
      </Link>
      {/* A chevron, not a slash: an area name can hold a slash ("Slack / Teams"). */}
      {shown.map((crumb) => (
        <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          <Link href={areaHref(slug, crumb.id)} className="truncate hover:text-foreground">
            {crumb.name}
          </Link>
        </span>
      ))}
    </nav>
  )
}

function flatten(areas: RenderedArea[]): RenderedArea[] {
  return areas.flatMap((a) => [a, ...flatten(a.children)])
}

function resolvedUnder(area: RenderedArea): RenderedPin[] {
  return [...area.resolved, ...area.children.flatMap(resolvedUnder)]
}

function NoArea() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
      <p className="font-display text-xl">No area here</p>
      <p className="text-sm text-muted-foreground">It was deleted, or the link is wrong.</p>
      <Link href={`/${slug}/product`} className="text-sm underline">
        Back to the Product Map
      </Link>
    </main>
  )
}

function AreaPageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-6" aria-busy="true">
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <Skeleton className="h-9 w-1/3" />
        <div className="flex gap-4">
          {['w-24', 'w-20', 'w-28', 'w-36'].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {['w-24', 'w-20', 'w-28'].map((w, i) => (
            <Skeleton key={i} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
      </section>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col divide-y rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </main>
  )
}
