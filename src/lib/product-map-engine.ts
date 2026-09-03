// Pure engine for the Product Map. It takes the frames and the team's "today"
// (ISO date string, resolved in the team timezone — see team-time.ts) and
// returns the rendered map model. No React, no Liveblocks, no clock of its own,
// the same shape as the cycle list engine.

import type { Area, Frame, FrameKind, FrameType } from '@/product-map-liveblocks.config'

// Kind is how much a problem hurts. It is the only axis with a color on the map.
export const FRAME_KINDS = ['brand_burn', 'pain_point', 'unlock_win'] as const

// Type is where a problem came from and how it gets worked. Type selects the
// playbook (ADR 0025), and it gets NO visual channel on the map.
export const FRAME_TYPES = ['bug', 'idea', 'request', 'security', 'irritant'] as const

// A pin's color is its Kind, and nothing else. Hues are taken from the scope
// palette so the two surfaces stay in one visual family: red burns, amber
// hurts, green is a win waiting to be unlocked.
export const KIND_COLORS: Record<FrameKind, string> = {
  brand_burn: '#e5484d',
  pain_point: '#ffb224',
  unlock_win: '#30a46c',
}

export const DEFAULT_KIND: FrameKind = 'pain_point'

export function isFrameKind(value: unknown): value is FrameKind {
  return (FRAME_KINDS as readonly unknown[]).includes(value)
}

export function isFrameType(value: unknown): value is FrameType {
  return (FRAME_TYPES as readonly unknown[]).includes(value)
}

/** A pin is only how a frame is drawn. It holds no data of its own. */
export type RenderedPin = {
  frameId: string
  areaId: string
  kind: FrameKind
  type: FrameType
  problem: string
  /** Color is the Kind. The other three pin channels arrive with their tickets. */
  color: string
  /**
   * Whole days between the frame's last wake and today. null when the frame has
   * never been woken or carries an unreadable date. Freshness reads this (#224).
   */
  daysSinceWoken: number | null
}

// An area's shape is GENERATED from its grid position, because an agent must be
// able to create an area and an agent cannot draw. Nothing about the geometry is
// stored, so the app stays free to redraw the land later.
const AREA_WIDTH = 320
const AREA_HEIGHT = 220
export const AREA_GAP = 24
/** Each level of nesting draws smaller, so a sub-area reads as inside its parent. */
const SUB_AREA_SCALE = 0.7

/** A region of the product, drawn from its position. Never colored by its frames. */
export type RenderedArea = {
  areaId: string
  name: string
  parentAreaId: string | null
  /** Generated from the area's grid position. See AREA_WIDTH. */
  shape: { x: number; y: number; width: number; height: number }
  /** The suggested Frame owner for this area, and nothing more. */
  owner: string | null
  pins: RenderedPin[]
  children: RenderedArea[]
}

export type ProductMapModel = {
  pins: RenderedPin[]
  areas: RenderedArea[]
  /** Frames that belong to no area. Unmapped is always a valid result. */
  unmapped: RenderedPin[]
}

export function renderProductMap(input: {
  /** Optional: a room root that predates the areas list still renders. */
  areas?: Area[]
  frames: Frame[]
  today: string
}): ProductMapModel {
  const areas = input.areas ?? []
  // A resolved frame leaves the map: a person decided the problem is gone.
  // It is never deleted, so it stays readable through a filtered query.
  const pins = input.frames.filter((f) => !f.resolved).map((f) => renderPin(f, input.today))

  const known = new Set(areas.map((a) => a.id))
  const pinsByArea = new Map<string, RenderedPin[]>()
  const unmapped: RenderedPin[] = []
  for (const pin of pins) {
    // A dangling area id is not a home, so the frame falls to Unmapped rather
    // than vanishing with the area that used to hold it.
    if (!known.has(pin.areaId)) {
      unmapped.push(pin)
      continue
    }
    const bucket = pinsByArea.get(pin.areaId)
    if (bucket) bucket.push(pin)
    else pinsByArea.set(pin.areaId, [pin])
  }

  return { pins, areas: buildAreaTree(areas, pinsByArea), unmapped }
}

function buildAreaTree(
  areas: Area[],
  pinsByArea: Map<string, RenderedPin[]>
): RenderedArea[] {
  const known = new Set(areas.map((a) => a.id))
  const childrenOf = new Map<string, Area[]>()
  for (const area of areas) {
    const parent = area.parentAreaId
    if (!parent || !known.has(parent)) continue
    const siblings = childrenOf.get(parent)
    if (siblings) siblings.push(area)
    else childrenOf.set(parent, [area])
  }

  const drawn = new Set<string>()
  const render = (area: Area, depth: number): RenderedArea => {
    drawn.add(area.id)
    return {
      areaId: area.id,
      name: area.name,
      parentAreaId: area.parentAreaId ?? null,
      shape: areaShape(area, depth),
      owner: area.owner ?? null,
      pins: pinsByArea.get(area.id) ?? [],
      children: (childrenOf.get(area.id) ?? [])
        .filter((child) => !drawn.has(child.id))
        .map((child) => render(child, depth + 1)),
    }
  }

  // An area whose parent is gone is promoted rather than lost. The second pass
  // catches anything a parent loop left undrawn, so storage can never hide land.
  const roots = areas
    .filter((a) => !a.parentAreaId || !known.has(a.parentAreaId))
    .map((a) => render(a, 0))
  // Checked one at a time, because rendering one area draws its children too.
  const rescued: RenderedArea[] = []
  for (const area of areas) {
    if (!drawn.has(area.id)) rescued.push(render(area, 0))
  }
  return [...roots, ...rescued]
}

function areaShape(area: Area, depth: number): RenderedArea['shape'] {
  const scale = SUB_AREA_SCALE ** depth
  const width = AREA_WIDTH * scale
  const height = AREA_HEIGHT * scale
  return { x: area.x * (width + AREA_GAP), y: area.y * (height + AREA_GAP), width, height }
}

function renderPin(frame: Frame, today: string): RenderedPin {
  const kind = isFrameKind(frame.kind) ? frame.kind : DEFAULT_KIND
  return {
    frameId: frame.id,
    areaId: frame.areaId ?? '',
    kind,
    type: frame.type,
    problem: frame.problem,
    color: KIND_COLORS[kind],
    daysSinceWoken: daysBetween(frame.last_woken, today),
  }
}

/** Whole days from `from` to `to`, both ISO calendar dates. null if either is unreadable. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}
