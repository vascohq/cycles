'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { useMember } from '@/components/organization-users-context'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import { TypeIcon } from '@/components/product-map/frame-icons'
import { freshnessOf, type Freshness } from '@/lib/frame-list'
import { flattenAreas, type RenderedArea, type RenderedPin } from '@/lib/product-map-engine'

import { FRESHNESS_LABELS, STATE_LABELS, TYPE_LABELS } from '@/components/product-map/labels'
import { UNMAPPED_AREA, areaHref, frameHref } from './links'

/**
 * Frames as a list, each with a freshness signal. It shows what it is given:
 * the caller filters and orders the frames (frame-filters), so the list and the
 * map always agree on what is shown.
 *
 * `areas` names the area on each row.
 */
export function FrameList({
  pins,
  areas,
  action,
  dense = false,
}: {
  pins: RenderedPin[]
  areas: RenderedArea[]
  /** One control at the end of each row, such as filing on the Unmapped page. */
  action?: (pin: RenderedPin) => React.ReactNode
  /** One column only, for a narrow panel over the map. */
  dense?: boolean
}) {
  const { slug } = useParams<{ slug: string }>()
  const names = areaNames(areas)
  return (
    <section aria-label="Frames" className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {pins.length} {pins.length === 1 ? 'frame' : 'frames'}
      </p>
      {pins.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No frame matches these filters.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {pins.map((pin) => (
            <Row
              key={pin.frameId}
              pin={pin}
              slug={slug}
              areaName={pin.areaId ? names.get(pin.areaId) : undefined}
              action={action?.(pin)}
              dense={dense}
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
  dense,
}: {
  pin: RenderedPin
  slug: string
  areaName?: string
  action?: React.ReactNode
  dense: boolean
}) {
  const owner = useMember(pin.owner)
  const customers = pin.reports.filter((r) => r.source === 'customer').length
  return (
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 ${
        dense ? '' : 'md:grid-cols-[1fr_9rem_7rem_auto]'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <TypeIcon
          type={pin.type}
          color={pin.color}
          sharp={pin.sharp}
          label={TYPE_LABELS[pin.type]}
          className="mt-0.5 h-4 w-4"
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
      <div
        className={`hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground ${dense ? '' : 'md:flex'}`}
      >
        {owner ? (
          <>
            <UserAvatar user={owner} /> <span className="truncate">{owner.name}</span>
          </>
        ) : (
          <span className="text-amber-600">No owner</span>
        )}
      </div>
      <div className={`hidden text-xs text-muted-foreground ${dense ? '' : 'md:block'}`}>
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
            className={`w-1 rounded-sm ${n <= bars ? (level === 'top_of_mind' ? 'bg-foreground' : 'bg-foreground/50') : 'bg-border'}`}
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

function areaNames(areas: RenderedArea[]): Map<string, string> {
  return new Map(flattenAreas(areas).map(({ area }) => [area.areaId, area.name]))
}
