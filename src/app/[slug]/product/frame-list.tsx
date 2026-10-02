'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useOrganizationUsers } from '@/components/organization-users-context'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FILTER_KEYS,
  FRESHNESS_LEVELS,
  freshnessOf,
  listFrames,
  type FrameFilters,
  type Freshness,
} from '@/lib/frame-list'
import {
  FRAME_KINDS,
  FRAME_TYPES,
  type FrameState,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'

import { FRESHNESS_LABELS, KIND_LABELS, STATE_LABELS, TYPE_LABELS } from './labels'
import { UNMAPPED_AREA, areaHref, frameHref } from './links'

/** Select needs a value for "any"; an empty string is not allowed. */
const ANY = '__any__'
const STATES: FrameState[] = [
  'rough',
  'candidate',
  'in_flight',
  'released',
  'monitoring',
  'resolved',
]

/**
 * Every frame as a list, with filters and a freshness signal. The filters live
 * in the URL, so a filtered list is a link somebody can share. The Product Map
 * and each area page use it.
 *
 * `areas` names the area on each row and fills the Area filter. An area page
 * passes its own area, so the filter offers it and its sub-areas.
 */
type ListProps = {
  pins: RenderedPin[]
  areas: RenderedArea[]
  /** One control at the end of each row, such as filing on the Unmapped page. */
  action?: (pin: RenderedPin) => React.ReactNode
}

export function FrameList(props: ListProps) {
  // The filters read the URL, and Next wants a Suspense boundary round that.
  return (
    <Suspense>
      <FilteredList {...props} />
    </Suspense>
  )
}

function FilteredList({ pins, areas, action }: ListProps) {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const users = useOrganizationUsers()

  const filters = Object.fromEntries(
    FILTER_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key)]] : [])),
  ) as FrameFilters
  const names = areaNames(areas)
  const shown = listFrames(
    pins,
    filters,
    filters.area ? areaIdsUnder(areas, filters.area) : undefined,
  )
  const active = FILTER_KEYS.some((key) => key !== 'sort' && params.get(key))

  function set(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === ANY) next.delete(key)
    else next.set(key, value)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <section aria-label="Frames" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {areas.length > 0 && (
          <Filter
            label="Area"
            value={filters.area}
            onChange={(v) => set('area', v)}
            options={[
              ...flatten(areas).map(({ area, depth }) => ({
                value: area.areaId,
                label: `${'  '.repeat(depth)}${area.name}`,
              })),
              { value: UNMAPPED_AREA, label: 'Unmapped' },
            ]}
          />
        )}
        <Filter
          label="Kind"
          value={filters.kind}
          onChange={(v) => set('kind', v)}
          options={FRAME_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
        />
        <Filter
          label="Type"
          value={filters.type}
          onChange={(v) => set('type', v)}
          options={FRAME_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        />
        <Filter
          label="State"
          any="Open"
          value={filters.state}
          onChange={(v) => set('state', v)}
          options={STATES.map((s) => ({ value: s, label: STATE_LABELS[s] }))}
        />
        <Filter
          label="Owner"
          value={filters.owner}
          onChange={(v) => set('owner', v)}
          options={[
            { value: 'nobody', label: 'Nobody yet' },
            ...users.map((u) => ({ value: u.userId, label: u.name })),
          ]}
        />
        <Filter
          label="Heard from"
          value={filters.source}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'customer', label: 'Customers' },
            { value: 'internal', label: 'Internal' },
          ]}
        />
        <Filter
          label="Freshness"
          value={filters.freshness}
          onChange={(v) => set('freshness', v)}
          options={FRESHNESS_LEVELS.map((f) => ({ value: f, label: FRESHNESS_LABELS[f] }))}
        />
        <Filter
          label="Sort"
          any="Top of mind"
          value={filters.sort}
          onChange={(v) => set('sort', v)}
          options={[{ value: 'reports', label: 'Most reported' }]}
        />
        {active && (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} {shown.length === 1 ? 'frame' : 'frames'}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No frame matches these filters.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {shown.map((pin) => (
            <Row
              key={pin.frameId}
              pin={pin}
              slug={slug}
              areaName={pin.areaId ? names.get(pin.areaId) : undefined}
              action={action?.(pin)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({
  pin,
  slug,
  areaName,
  action,
}: {
  pin: RenderedPin
  slug: string
  areaName?: string
  action?: React.ReactNode
}) {
  const users = useOrganizationUsers()
  const owner = pin.owner ? users.find((u) => u.userId === pin.owner) : undefined
  const customers = pin.reports.filter((r) => r.source === 'customer').length
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 md:grid-cols-[1fr_9rem_7rem_auto]">
      <div className="flex min-w-0 items-start gap-2.5">
        {/* The pin's own color and fill: Kind, and hollow while rough. */}
        <span
          aria-hidden
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2"
          style={{ borderColor: pin.color, backgroundColor: pin.sharp ? pin.color : 'transparent' }}
        />
        <div className="min-w-0">
          <Link
            href={frameHref(slug, pin.frameId)}
            className="line-clamp-2 text-sm font-medium hover:underline"
          >
            {pin.problem || 'Untitled frame'}
          </Link>
          <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
            {areaName ? (
              <Link
                href={areaHref(slug, pin.areaId)}
                className="hover:text-foreground hover:underline"
              >
                {areaName}
              </Link>
            ) : (
              <Link
                href={areaHref(slug, UNMAPPED_AREA)}
                className="hover:text-foreground hover:underline"
              >
                Unmapped
              </Link>
            )}
            <span>· {TYPE_LABELS[pin.type]}</span>
            <span>· {STATE_LABELS[pin.state]}</span>
            {pin.worked && <span title="We have bet on this before">· ✳</span>}
          </p>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
        {owner ? (
          <>
            <UserAvatar user={owner} /> <span className="truncate">{owner.name}</span>
          </>
        ) : (
          <span className="text-amber-600">No owner</span>
        )}
      </div>
      <div className="hidden text-xs text-muted-foreground md:block">
        {pin.reports.length} reported
        {customers > 0 && <span className="block">{customers} from customers</span>}
      </div>
      <div className="flex items-center justify-end gap-3">
        <FreshnessMark pin={pin} />
        {action}
      </div>
    </li>
  )
}

/** Three bars, like a signal: how much this frame is still being talked about. */
function FreshnessMark({ pin }: { pin: RenderedPin }) {
  const level: Freshness = freshnessOf(pin.opacity)
  const bars = level === 'top_of_mind' ? 3 : level === 'cooling' ? 2 : 1
  const when =
    pin.daysSinceWoken === null
      ? 'Never mentioned'
      : pin.daysSinceWoken === 0
        ? 'Mentioned today'
        : `Mentioned ${pin.daysSinceWoken} ${pin.daysSinceWoken === 1 ? 'day' : 'days'} ago`
  return (
    <div className="flex items-center justify-end gap-2 text-xs" title={when}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`w-1 rounded-sm ${n <= bars ? (level === 'top_of_mind' ? 'bg-fuchsia-600' : 'bg-foreground/60') : 'bg-border'}`}
            style={{ height: 4 + n * 3 }}
          />
        ))}
      </span>
      <span className={level === 'top_of_mind' ? 'font-medium' : 'text-muted-foreground'}>
        {FRESHNESS_LABELS[level]}
      </span>
    </div>
  )
}

function Filter({
  label,
  value,
  onChange,
  options,
  any = 'Any',
}: {
  label: string
  value?: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  any?: string
}) {
  return (
    <Select value={value ?? ANY} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={`h-8 w-auto gap-1.5 rounded-full px-3 text-xs ${value ? 'border-foreground' : ''}`}
      >
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="whitespace-pre">{o.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function flatten(areas: RenderedArea[], depth = 0): { area: RenderedArea; depth: number }[] {
  return areas.flatMap((area) => [{ area, depth }, ...flatten(area.children, depth + 1)])
}

function areaNames(areas: RenderedArea[]): Map<string, string> {
  return new Map(flatten(areas).map(({ area }) => [area.areaId, area.name]))
}

/** The chosen area and every area under it. "unmapped" stands for no area. */
function areaIdsUnder(areas: RenderedArea[], areaId: string): Set<string> {
  if (areaId === UNMAPPED_AREA) return new Set([UNMAPPED_AREA])
  const root = flatten(areas).find(({ area }) => area.areaId === areaId)?.area
  return new Set(root ? flatten([root]).map(({ area }) => area.areaId) : [areaId])
}

/**
 * A link to an area page, with the number of open frames under it. The dashed
 * one is Unmapped: the holding area that nobody draws.
 */
export function AreaChip({
  areaId,
  name,
  count,
  special = false,
}: {
  areaId: string
  name: string
  count: number
  special?: boolean
}) {
  const { slug } = useParams<{ slug: string }>()
  return (
    <Link
      href={areaHref(slug, areaId)}
      className={`flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm hover:bg-muted ${
        special ? 'border-dashed text-muted-foreground' : ''
      }`}
    >
      {name}
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
  )
}
