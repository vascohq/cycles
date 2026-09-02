import { LiveList, LiveObject } from '@liveblocks/client'

/**
 * The Product Map lives in its own org-scoped room, outside the per-cycle room
 * model (ADR 0021). The prefix is the orgId, or the userId for a personal
 * workspace — the same prefix the cycle rooms use.
 */
export function productMapRoomId(orgPrefix: string): string {
  return `${orgPrefix}:product-map`
}

// Area carries only its id for now. Its fields arrive with #220, the ticket
// that renders areas and files a frame into one.
export type Area = {
  id: string
}

/** How much a problem hurts. The only axis with a color on the map. */
export type FrameKind = 'brand_burn' | 'pain_point' | 'unlock_win'

/** Where a problem came from and how it gets worked. Type selects the playbook (ADR 0025). */
export type FrameType = 'bug' | 'idea' | 'request' | 'security' | 'irritant'

/** One record of the problem happening. Nothing reaches a frame unmediated. */
export type FrameReport = {
  /** A Clerk user id or an agent id. Provenance is never anonymous. */
  capturer: string
  source: 'internal' | 'customer'
  /** Free-text customer label. There is no customer entity, by design. */
  customer?: string
  link?: string
  text: string
  /** ISO date (YYYY-MM-DD). */
  date: string
}

/** An outbound link a frame packages. The artifact itself is never stored. */
export type FramePointer = {
  url: string
  label: string
  kind: string
}

/**
 * One frame is one problem. The unit of capture and the central object of the
 * Product Map. A frame is not a piece of work: work is a Shape in a cycle that
 * points home to the frame (ADR 0022).
 *
 * A frame holds NO outcome. Outcome is a product of shaping and lives on the
 * Shape. Sharpness, frame state, the candidate statement and the gap list are
 * all DERIVED in product-map-engine, never stored.
 */
export type Frame = {
  id: string
  /** Empty when the frame is Unmapped — always a valid result. */
  areaId?: string
  kind: FrameKind
  type: FrameType
  problem: string
  /** The time the business will spend. A frame with no appetite is rough. */
  appetite: string
  /** Free text: who is affected, what it is worth, why now. */
  business_case: string
  /** Clerk user id of the one person who cares that this gets addressed. */
  owner?: string
  /** The frame whose monitoring surfaced this one (ADR 0025). */
  originFrameId?: string
  reports: FrameReport[]
  pointers: FramePointer[]
  /**
   * ISO date (YYYY-MM-DD) of the last wake. Only three things set it: a new
   * report, a wake call, and an explicit "still hurts" click (ADR 0024).
   */
  last_woken: string
  /** Only a person resolves a frame. Nothing resolves on a timer. */
  resolved: boolean
}

export type ProductMapStorage = {
  areas: LiveList<LiveObject<Area>>
  frames: LiveList<LiveObject<Frame>>
}
