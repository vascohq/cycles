'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { CrumbMenu, SectionCrumb } from '@/components/crumb-menu'
import { cn } from '@/lib/utils'

import type { Area, Frame } from '@/product-map-liveblocks.config'

import { UNMAPPED_AREA, areaHref, frameHref } from './links'

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
 * One area in a breadcrumb. With siblings it is a menu that switches between
 * them; alone, a plain link. A top-level area's siblings are the other
 * top-level areas and Unmapped, because Unmapped is the other place a frame
 * can sit at the top of the map.
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
  const parentId = area?.parentAreaId ?? ''
  const items = [
    ...areas
      .filter((a) => (a.parentAreaId ?? '') === parentId)
      .map((a) => ({ href: areaHref(slug, a.id), label: a.name, current: a.id === areaId })),
    ...(parentId
      ? []
      : [
          {
            href: areaHref(slug, UNMAPPED_AREA),
            label: 'Unmapped',
            current: !area,
          },
        ]),
  ]
  const label = area?.name ?? 'Unmapped'
  if (items.length < 2) {
    return (
      <Link
        href={areaHref(slug, areaId)}
        className={cn(
          'truncate',
          current ? 'font-medium text-foreground' : 'hover:text-foreground',
        )}
      >
        {label}
      </Link>
    )
  }
  return <CrumbMenu label={label} current={current} items={items} />
}

/**
 * The frame part of a breadcrumb on a frame page: switches to another open
 * frame in the same area.
 */
export function FrameCrumb({ frames, frameId }: { frames: Frame[]; frameId: string }) {
  const { slug } = useParams<{ slug: string }>()
  const frame = frames.find((f) => f.id === frameId)
  const label = frame?.problem || 'Untitled frame'
  const items = frames
    .filter((f) => (f.areaId || '') === (frame?.areaId || '') && (!f.resolved || f.id === frameId))
    .map((f) => ({
      href: frameHref(slug, f.id),
      label: f.problem || 'Untitled frame',
      current: f.id === frameId,
    }))
  if (items.length < 2) return <span className="truncate font-medium text-foreground">{label}</span>
  return <CrumbMenu label={label} current items={items} />
}

/**
 * Product Map › region › … › area, then `children` (a frame page adds its
 * frame). The section and every area part are menus. On an area page the
 * last part is the page itself, so the page passes `trailing={false}` and
 * adds it as the current part.
 */
export function Crumbs({
  areas,
  areaId,
  trailing = true,
  children,
}: {
  areas: Area[]
  areaId: string
  trailing?: boolean
  children?: React.ReactNode
}) {
  const path = areaPath(areas, areaId)
  const ids = path.length ? path.map((a) => a.id) : [UNMAPPED_AREA]
  const shown = trailing ? ids : ids.slice(0, -1)
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <SectionCrumb section="Product Map" current={!shown.length && !children} />
      {/* A chevron, not a slash: an area name can hold a slash ("Slack / Teams"). */}
      {shown.map((id) => (
        <span key={id} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          <AreaCrumb areas={areas} areaId={id} />
        </span>
      ))}
      {children && (
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          {children}
        </span>
      )}
    </nav>
  )
}
