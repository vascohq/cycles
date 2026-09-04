import { LiveList, LiveObject } from '@liveblocks/client'

/**
 * The Product Map lives in its own org-scoped room, outside the per-cycle room
 * model (ADR 0021). The prefix is the orgId, or the userId for a personal
 * workspace — the same prefix the cycle rooms use.
 */
export function productMapRoomId(orgPrefix: string): string {
  return `${orgPrefix}:product-map`
}

/**
 * A named region of the product, for example Integrations or Billing. An area
 * with a `parentAreaId` is a sub-area.
 *
 * An **Island** and an **Archipelago** are never stored: they are the merged
 * silhouette of an area's children, fused at render time. Only leaf areas carry
 * an `outline`, so there is one drawn thing and two derived ones.
 */
export type Area = {
  id: string
  name: string
  /** The area this one sits inside. Absent for a top-level area. */
  parentAreaId?: string
  x: number
  y: number
  /**
   * The area's coastline: a closed ring of `[x, y]` points in the map's world
   * space (0…1000 on both axes), which an agent writes from a description. An
   * area with no outline gets one generated around its grid cell, so land drawn
   * before this existed still renders and nothing needs migrating.
   */
  outline?: [number, number][]
  /** Clerk user id. The suggested Frame owner for this area, and nothing more. */
  owner?: string
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

/**
 * The kind of artifact a pointer points at. A frame's Type selects a playbook,
 * and the playbook names which of these it expects (product-map-engine).
 *
 * There is deliberately no kind for a Shape: a shape points at its frame, never
 * the reverse (ADR 0022).
 */
export type PointerKind =
  | 'issue'
  | 'wayfinder'
  | 'research'
  | 'shaped_doc'
  | 'pull_request'
  | 'conversation'

/**
 * One observable change the frame says must be true afterwards. Each outcome is
 * ONE item, because the shape is checked against them one at a time: a reader
 * has to be able to tell whether each one happened.
 *
 * An outcome states a change in the world, never delivered functionality. "A
 * gym owner knows on the day a payment fails" is an outcome; "the user can
 * filter the table" is a mechanism.
 */
export type FrameOutcome = {
  id: string
  text: string
}

/** An outbound link a frame packages. The artifact itself is never stored. */
export type FramePointer = {
  url: string
  label: string
  kind: PointerKind
}

/**
 * One frame is one problem. The unit of capture and the central object of the
 * Product Map. A frame is not a piece of work: work is a Shape in a cycle that
 * points home to the frame (ADR 0022).
 *
 * A frame holds its OUTCOMES: what must be true afterwards. Framing decides
 * that, not shaping, so two shapes attacking one frame chase the same win.
 * Sharpness, frame state, the candidate statement and the gap list are all
 * DERIVED in product-map-engine, never stored.
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
   * What must be true afterwards. A frame with none is not sharp: nobody bets
   * on a frame that never says what changes. Frames captured before outcomes
   * existed have no such field, so every reader treats it as possibly absent.
   */
  outcomes: FrameOutcome[]
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
