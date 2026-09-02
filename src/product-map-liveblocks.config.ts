import { LiveList, LiveObject } from '@liveblocks/client'

/**
 * The Product Map lives in its own org-scoped room, outside the per-cycle room
 * model (ADR 0021). The prefix is the orgId, or the userId for a personal
 * workspace — the same prefix the cycle rooms use.
 */
export function productMapRoomId(orgPrefix: string): string {
  return `${orgPrefix}:product-map`
}

// Area and Frame carry only their ids for now. Their fields arrive with the
// tickets that render them (#219 for Frame, #220 for Area). The room and its
// two lists come first, so the route can open on an empty Product Map.
export type Area = {
  id: string
}

export type Frame = {
  id: string
}

export type ProductMapStorage = {
  areas: LiveList<LiveObject<Area>>
  frames: LiveList<LiveObject<Frame>>
}
