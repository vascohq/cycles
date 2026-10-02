'use client'

import { Suspense } from 'react'
import {
  Activity,
  ArrowUpDown,
  ArrowUpRight,
  CircleDot,
  CircleUser,
  Flame,
  Map as MapIcon,
  MessagesSquare,
  Shapes,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useOrganizationUsers } from '@/components/organization-users-context'
import { KIND_ICONS, TYPE_ICONS } from '@/components/product-map/frame-icons'
import { FilterDropdown } from '@/components/filter-dropdown'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  FILTER_KEYS,
  FRESHNESS_LEVELS,
  NO_OWNER,
  UNMAPPED_AREA,
  listFrames,
  type FrameFilters,
} from '@/lib/frame-list'
import {
  FRAME_KINDS,
  FRAME_TYPES,
  KIND_COLORS,
  FRAME_STATES,
  flattenAreas,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'

import { FrameList } from './frame-list'
import {
  FRESHNESS_LABELS,
  KIND_LABELS,
  STATE_LABELS,
  TYPE_LABELS,
} from '@/components/product-map/labels'
import { areaHref } from './links'

/**
 * The frame filters, read from and written to the URL, so a filtered view is a
 * link somebody can share. One set of filters shapes both the list and the map.
 * A caller needs a Suspense boundary above it, because it reads the URL.
 */
export function useFrameFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = Object.fromEntries(
    FILTER_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key)]] : []))
  ) as FrameFilters

  function set(key: (typeof FILTER_KEYS)[number], value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return {
    filters,
    set,
    clear: () => router.replace(pathname, { scroll: false }),
    active: FILTER_KEYS.some((key) => key !== 'sort' && params.get(key)),
  }
}

/** The frames that pass the filters, in order, and their ids for the map. */
export function useFilteredFrames(pins: RenderedPin[], areas: RenderedArea[]) {
  const { filters } = useFrameFilters()
  const shown = listFrames(
    pins,
    filters,
    filters.area ? areaIdsUnder(areas, filters.area) : undefined
  )
  return { shown, keep: new Set(shown.map((p) => p.frameId)) }
}

/**
 * Every filter as a chip, the same chip as the Kanban board's Scope and
 * Assignee filters. `areas` fills the Area filter. An area page passes its own
 * area, so the filter offers it and its sub-areas. `withUnmapped` offers
 * Unmapped too, which only the whole map holds.
 */
export function FilterBar({
  areas,
  withUnmapped = false,
}: {
  areas: RenderedArea[]
  withUnmapped?: boolean
}) {
  const { filters, set, clear, active } = useFrameFilters()
  const users = useOrganizationUsers()
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      {areas.length > 0 && (
        <Filter
          label="Area"
          icon={MapIcon}
          value={filters.area}
          onChange={(v) => set('area', v)}
          options={[
            ...flattenAreas(areas).map(({ area, depth }) => ({
              value: area.areaId,
              label: area.name,
              depth,
            })),
            ...(withUnmapped ? [{ value: UNMAPPED_AREA, label: 'Unmapped' }] : []),
          ]}
        />
      )}
      {filters.area && <AreaPageLink areaId={filters.area} />}
      <Filter
        label="Kind"
        icon={Flame}
        value={filters.kind}
        onChange={(v) => set('kind', v)}
        options={FRAME_KINDS.map((k) => ({
          value: k,
          label: KIND_LABELS[k],
          icon: KIND_ICONS[k],
          color: KIND_COLORS[k],
        }))}
      />
      <Filter
        label="Type"
        icon={Shapes}
        value={filters.type}
        onChange={(v) => set('type', v)}
        options={FRAME_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t], icon: TYPE_ICONS[t] }))}
      />
      <Filter
        label="State"
        icon={CircleDot}
        value={filters.state}
        onChange={(v) => set('state', v)}
        options={FRAME_STATES.map((s) => ({ value: s, label: STATE_LABELS[s] }))}
      />
      <Filter
        label="Owner"
        icon={CircleUser}
        value={filters.owner}
        onChange={(v) => set('owner', v)}
        options={[
          { value: NO_OWNER, label: 'Nobody yet' },
          ...users.map((u) => ({ value: u.userId, label: u.name })),
        ]}
      />
      <Filter
        label="Heard from"
        icon={MessagesSquare}
        value={filters.source}
        onChange={(v) => set('source', v)}
        options={[
          { value: 'customer', label: 'Customers' },
          { value: 'internal', label: 'Internal' },
        ]}
      />
      <Filter
        label="Freshness"
        icon={Activity}
        value={filters.freshness}
        onChange={(v) => set('freshness', v)}
        options={FRESHNESS_LEVELS.map((f) => ({ value: f, label: FRESHNESS_LABELS[f] }))}
      />
      <Filter
        label="Top of mind first"
        icon={ArrowUpDown}
        value={filters.sort}
        onChange={(v) => set('sort', v)}
        options={[{ value: 'reports', label: 'Most reported' }]}
      />
      {active && (
        <button
          type="button"
          onClick={clear}
          className="px-1 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

/**
 * The filter bar above the list, for a page with no map to float it over: the
 * Unmapped page, and a map with no land yet.
 */
type FilteredFramesProps = {
  pins: RenderedPin[]
  areas: RenderedArea[]
  action?: (pin: RenderedPin) => React.ReactNode
}

export function FilteredFrames(props: FilteredFramesProps) {
  return (
    <Suspense>
      <Stacked {...props} />
    </Suspense>
  )
}

function Stacked({ pins, areas, action }: FilteredFramesProps) {
  const { shown } = useFilteredFrames(pins, areas)
  return (
    <div className="flex flex-col gap-3">
      <FilterBar areas={areas} />
      <FrameList pins={shown} areas={areas} action={action} />
    </div>
  )
}

/** One filter. A chosen option with an icon of its own shows that icon in the chip. */
function Filter({
  label,
  icon: Icon,
  value,
  onChange,
  options,
}: {
  label: string
  icon: LucideIcon
  value?: string
  onChange: (value: string | null) => void
  options: { value: string; label: string; icon?: LucideIcon; color?: string; depth?: number }[]
}) {
  const chosen = options.find((o) => o.value === value)
  const ChipIcon = chosen?.icon ?? Icon
  return (
    <FilterDropdown
      label={label}
      icon={
        <ChipIcon
          className="h-3.5 w-3.5"
          style={chosen?.color ? { color: chosen.color } : undefined}
        />
      }
      value={chosen?.label ?? null}
      onClear={() => onChange(null)}
    >
      {options.map((o) => (
        <DropdownMenuItem
          key={o.value}
          onClick={() => onChange(o.value)}
          style={o.depth ? { paddingLeft: 8 + o.depth * 12 } : undefined}
        >
          {o.icon && (
            <o.icon
              aria-hidden
              className={`mr-2 h-3.5 w-3.5 ${o.color ? '' : 'text-muted-foreground'}`}
              style={o.color ? { color: o.color } : undefined}
            />
          )}
          {o.label}
        </DropdownMenuItem>
      ))}
    </FilterDropdown>
  )
}

/** The chosen area and every area under it. "unmapped" stands for no area. */
function areaIdsUnder(areas: RenderedArea[], areaId: string): Set<string> {
  if (areaId === UNMAPPED_AREA) return new Set([UNMAPPED_AREA])
  const root = flattenAreas(areas).find(({ area }) => area.areaId === areaId)?.area
  return new Set(root ? flattenAreas([root]).map(({ area }) => area.areaId) : [areaId])
}

/**
 * The page of the area the filter chose. The Area filter narrows this map; the
 * area page is the same view, zoomed to that area, with a URL of its own.
 */
function AreaPageLink({ areaId }: { areaId: string }) {
  const { slug } = useParams<{ slug: string }>()
  const pathname = usePathname()
  const href = areaHref(slug, areaId)
  if (pathname === href) return null
  return (
    <Link
      href={href}
      className="flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
    >
      Open area page <ArrowUpRight className="h-3 w-3" />
    </Link>
  )
}
