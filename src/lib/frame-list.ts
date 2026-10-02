import type { FrameKind, FrameType } from '@/product-map-liveblocks.config'
import type { FrameState, RenderedPin } from '@/lib/product-map-engine'

/**
 * How top of mind a frame is, read from the same freshness the pin fades by.
 * Opacity falls from 1 to its floor over the sleep window (two cycles), so with
 * six-week cycles "top of mind" means a mention in the last two or three weeks,
 * "cooling" a mention within the cycle, and "fading" anything older.
 */
export type Freshness = 'top_of_mind' | 'cooling' | 'fading'

export const FRESHNESS_LEVELS: Freshness[] = ['top_of_mind', 'cooling', 'fading']

export function freshnessOf(opacity: number): Freshness {
  if (opacity >= 0.8) return 'top_of_mind'
  if (opacity >= 0.5) return 'cooling'
  return 'fading'
}

/**
 * The filters on a frame list. Every value is a URL search param, so a filtered
 * list has a link somebody can share. An absent key means "any".
 */
export type FrameFilters = {
  /** An area id, or "unmapped". Matches the area and every area under it. */
  area?: string
  kind?: FrameKind
  type?: FrameType
  /** Absent means every state but resolved: a resolved frame is off the map. */
  state?: FrameState
  /** A Clerk user id, or "nobody". */
  owner?: string
  /** Frames with at least one report from that side — the heat lens. */
  source?: 'internal' | 'customer'
  freshness?: Freshness
  /** Absent means top of mind first. */
  sort?: 'reports'
}

export const FILTER_KEYS = ['area', 'kind', 'type', 'state', 'owner', 'source', 'freshness', 'sort'] as const

/**
 * The frames that pass every filter, in the order asked for. `areaIds` is the
 * chosen area and everything under it, resolved by the caller from the area
 * tree, so this stays a flat pass over the frames.
 */
export function listFrames(
  pins: RenderedPin[],
  filters: FrameFilters,
  areaIds?: Set<string>
): RenderedPin[] {
  const passed = pins.filter(
    (pin) =>
      (!areaIds || areaIds.has(pin.areaId || 'unmapped')) &&
      (!filters.kind || pin.kind === filters.kind) &&
      (!filters.type || pin.type === filters.type) &&
      (filters.state ? pin.state === filters.state : pin.state !== 'resolved') &&
      (!filters.owner || (filters.owner === 'nobody' ? !pin.owner : pin.owner === filters.owner)) &&
      (!filters.source || pin.reports.some((r) => r.source === filters.source)) &&
      (!filters.freshness || freshnessOf(pin.opacity) === filters.freshness)
  )
  return passed.sort(filters.sort === 'reports' ? byReports : byTopOfMind)
}

// Top of mind: the freshest first, and the most reported among equals. Past
// investment plays no part, so sunk cost never sets the order (ADR 0024).
function byTopOfMind(a: RenderedPin, b: RenderedPin): number {
  return b.opacity - a.opacity || b.reports.length - a.reports.length
}

function byReports(a: RenderedPin, b: RenderedPin): number {
  return b.reports.length - a.reports.length || b.opacity - a.opacity
}
