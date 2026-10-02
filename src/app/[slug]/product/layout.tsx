import { auth } from '@clerk/nextjs/server'
import { Inbox, Map, MapPin } from 'lucide-react'
import { NavGroup, NavLink, SidebarLayout } from '@/components/sidebar-layout'
import { getProductMapStorage } from '@/lib/mcp/liveblocks-reader'
import type { Area } from '@/product-map-liveblocks.config'
import { UNMAPPED_AREA } from '@/lib/frame-list'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { ProductCapture } from './product-map'

/**
 * The Product Map sidebar is the land as a tree: every area, nested under its
 * parent, with the number of open frames it holds. Unmapped frames get their
 * own entry, because "no area" is a valid place for a frame to be.
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { userId, orgId } = await auth()
  if (!userId) return children

  // Same URL as areaHref in ./links, which a server module cannot import
  // (it pulls in useParams).
  const areaHref = (areaId: string) => `/${slug}/product/areas/${areaId}`

  const { areas, frames } = await getProductMapStorage(orgId ?? userId)
  const open = frames.filter((f) => !f.resolved)
  const countIn = (areaId?: string) => open.filter((f) => (f.areaId || undefined) === areaId).length

  // Depth-first, so a child area sits right under its parent.
  const ids = new Set(areas.map((a) => a.id))
  const tree: { area: Area; depth: number }[] = []
  const walk = (parentId: string | undefined, depth: number) => {
    for (const area of areas) {
      // An area whose parent was deleted is shown at the top, not lost.
      const parent = area.parentAreaId && ids.has(area.parentAreaId) ? area.parentAreaId : undefined
      if (parent !== parentId) continue
      tree.push({ area, depth })
      walk(area.id, depth + 1)
    }
  }
  walk(undefined, 0)

  return (
    <SidebarLayout
      title="Product Map"
      action={<ProductCapture roomId={productMapRoomId(orgId ?? userId)} />}
      sidebar={
        <>
          <NavGroup label="Overview">
            <NavLink href={`/${slug}/product`} exact icon={<Map className="size-4" />} count={open.length}>
              The map
            </NavLink>
          </NavGroup>
          <NavGroup label="Areas">
            {tree.map(({ area, depth }) => (
              <NavLink
                key={area.id}
                href={areaHref(area.id)}
                depth={depth}
                icon={<MapPin className="size-4" />}
                count={countIn(area.id)}
              >
                {area.name}
              </NavLink>
            ))}
            <NavLink
              href={areaHref(UNMAPPED_AREA)}
              icon={<Inbox className="size-4" />}
              count={countIn(undefined)}
            >
              Unmapped
            </NavLink>
          </NavGroup>
        </>
      }
    >
      {children}
    </SidebarLayout>
  )
}
