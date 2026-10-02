'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { CrumbMenu } from '@/components/crumb-menu'

import type { Area } from '@/product-map-liveblocks.config'

import { UNMAPPED_AREA, areaHref } from './links'

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
 * One area in a breadcrumb. With siblings (areas under the same parent) it is a
 * menu that switches between them; alone, a plain link.
 */
export function AreaCrumb({
  areas,
  areaId,
  current = false,
}: {
  areas: Area[]
  areaId: string
  current?: boolean
}) {
  const { slug } = useParams<{ slug: string }>()
  const area = areas.find((a) => a.id === areaId)
  if (!area) {
    return (
      <Link
        href={areaHref(slug, UNMAPPED_AREA)}
        className={current ? 'font-medium text-foreground' : 'hover:text-foreground'}
      >
        Unmapped
      </Link>
    )
  }
  const siblings = areas.filter((a) => (a.parentAreaId ?? '') === (area.parentAreaId ?? ''))
  if (siblings.length < 2) {
    return (
      <Link
        href={areaHref(slug, area.id)}
        className={
          current ? 'truncate font-medium text-foreground' : 'truncate hover:text-foreground'
        }
      >
        {area.name}
      </Link>
    )
  }
  return (
    <CrumbMenu
      label={area.name}
      current={current}
      items={siblings.map((a) => ({
        href: areaHref(slug, a.id),
        label: a.name,
        current: a.id === area.id,
      }))}
    />
  )
}

/**
 * Product Map › region › … › area. Every area part switches to its siblings.
 * On an area page the last part is the page itself, so `trailing={false}`
 * drops it.
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
  const ids = path.length ? path.map((a) => a.id) : [UNMAPPED_AREA]
  const shown = trailing ? ids : ids.slice(0, -1)
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link href={`/${slug}/product`} className="shrink-0 hover:text-foreground">
        Product Map
      </Link>
      {/* A chevron, not a slash: an area name can hold a slash ("Slack / Teams"). */}
      {shown.map((id) => (
        <span key={id} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          <AreaCrumb areas={areas} areaId={id} />
        </span>
      ))}
    </nav>
  )
}
