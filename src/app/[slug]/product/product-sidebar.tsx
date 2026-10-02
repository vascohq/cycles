'use client'

import { useParams } from 'next/navigation'
import { ClientSideSuspense } from '@liveblocks/react'
import { Inbox, Map, MapPin } from 'lucide-react'

import { NavGroup, NavLink } from '@/components/sidebar-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { flattenAreas, renderProductMap } from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'
import {
  ProductMapRoomProvider,
  productMapInitialStorage,
  useProductMapStorage,
} from '@/product-map-room-context'
import type { Area, Frame } from '@/product-map-liveblocks.config'

import { CaptureMenu, CaptureTrigger, areaOptions, areaOwners } from './product-map'
import { UNMAPPED_AREA, areaHref } from './links'

/**
 * The Product Map sidebar: Capture, then the land as a tree, with the open
 * frames each area holds and an entry for Unmapped. It reads the room live in
 * the browser, so it costs no server read per page (ADR 0007) and a frame
 * captured anywhere counts at once. It lives in the section layout, so it
 * stays put while you move between map pages. Its provider shares the room
 * connection with the page's.
 */
export function ProductSidebar({ roomId }: { roomId: string }) {
  return (
    <ProductMapRoomProvider
      id={roomId}
      initialPresence={{}}
      initialStorage={productMapInitialStorage()}
    >
      <ClientSideSuspense
        fallback={
          <>
            <CaptureTrigger disabled />
            <div className="flex flex-col gap-2 px-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </>
        }
      >
        {() => <LiveSidebar />}
      </ClientSideSuspense>
    </ProductMapRoomProvider>
  )
}

function LiveSidebar() {
  const { slug } = useParams<{ slug: string }>()
  // Guarded reads: a room whose root predates either list must still render.
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  // The rendered tree is the same one the map draws, so the order and the
  // nesting match the land. Frames are left out: only the areas are needed.
  const tree = renderProductMap({ areas, frames: [], today: getTeamToday(new Date()) }).areas
  const open = frames.filter((f) => !f.resolved)
  const countIn = (areaId?: string) => open.filter((f) => (f.areaId || undefined) === areaId).length

  return (
    <>
      <CaptureMenu areas={areaOptions(tree)} areaOwners={areaOwners(tree)} />
      <NavGroup label="Overview">
        <NavLink
          href={`/${slug}/product`}
          exact
          icon={<Map className="size-4" />}
          count={open.length}
        >
          Product Map
        </NavLink>
      </NavGroup>
      <NavGroup label="Areas">
        {flattenAreas(tree).map(({ area, depth }) => (
          <NavLink
            key={area.areaId}
            href={areaHref(slug, area.areaId)}
            depth={depth}
            icon={<MapPin className="size-4" />}
            count={countIn(area.areaId)}
          >
            {area.name}
          </NavLink>
        ))}
        <NavLink
          href={areaHref(slug, UNMAPPED_AREA)}
          icon={<Inbox className="size-4" />}
          count={countIn(undefined)}
        >
          Unmapped
        </NavLink>
      </NavGroup>
    </>
  )
}
