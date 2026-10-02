'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'

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
