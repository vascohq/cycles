import type { RequestKind, RequestReport, RequestType } from '@/product-map-liveblocks.config'
import type { RequestState, RenderedArea, RenderedPin } from '@/lib/product-map-engine'

/**
 * How top of mind a request is, read from the same freshness the pin fades by.
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

/** The Area filter's value for the requests that belong to no area. */
export const UNMAPPED_AREA = 'unmapped'

/** The Owner filter's value for the requests that nobody owns. */
export const NO_OWNER = 'nobody'

/**
 * The filters on a request list. Every value is a URL search param, so a filtered
 * list has a link somebody can share. An absent key means "any".
 */
export type RequestFilters = {
  /** An area id, or "unmapped". Matches the area and every area under it. */
  area?: string
  kind?: RequestKind
  type?: RequestType
  /** Absent means every state but resolved: a resolved request is off the map. */
  state?: RequestState
  /** A Clerk user id, or "nobody". */
  owner?: string
  /** A Clerk user id, or the exact free-text name of somebody outside the app. */
  raised_by?: string
  /** Requests with at least one report from that side — the heat lens. */
  source?: RequestReport['source']
  freshness?: Freshness
  /** Absent means top of mind first. */
  sort?: 'reports'
}

export const FILTER_KEYS = [
  'area',
  'kind',
  'type',
  'state',
  'owner',
  'raised_by',
  'source',
  'freshness',
  'sort',
] as const

/**
 * The requests that pass every filter, in the order asked for. `areaIds` is the
 * chosen area and everything under it, resolved by the caller from the area
 * tree, so this stays a flat pass over the requests.
 */
export function listRequests(
  pins: RenderedPin[],
  filters: RequestFilters,
  areaIds?: Set<string>
): RenderedPin[] {
  const passed = pins.filter(
    (pin) =>
      (!areaIds || areaIds.has(pin.areaId || UNMAPPED_AREA)) &&
      (!filters.kind || pin.kind === filters.kind) &&
      (!filters.type || pin.type === filters.type) &&
      (filters.state ? pin.state === filters.state : pin.state !== 'resolved') &&
      (!filters.owner || (filters.owner === NO_OWNER ? !pin.owner : pin.owner === filters.owner)) &&
      (!filters.raised_by || pin.raisedBy === filters.raised_by) &&
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

/**
 * The area tree with only the requests in `keep` left on it, so the filters that
 * shape the list shape the map too. The land itself never changes: an area with
 * no request left still draws, so the map does not jump when a filter changes.
 */
export function keepRequests(areas: RenderedArea[], keep: Set<string>): RenderedArea[] {
  return areas.map((area) => ({
    ...area,
    pins: area.pins.filter((p) => keep.has(p.requestId)),
    resolved: area.resolved.filter((p) => keep.has(p.requestId)),
    children: keepRequests(area.children, keep),
  }))
}
