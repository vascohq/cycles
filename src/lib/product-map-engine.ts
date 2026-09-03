// Pure engine for the Product Map. It takes the frames and the team's "today"
// (ISO date string, resolved in the team timezone — see team-time.ts) and
// returns the rendered map model. No React, no Liveblocks, no clock of its own,
// the same shape as the cycle list engine.

import type {
  Area,
  Frame,
  FrameKind,
  FrameReport,
  FrameType,
} from '@/product-map-liveblocks.config'

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

/**
 * A frame's position in its life. Derived from what the frame points at and
 * never stored, so it can never drift from the truth (ADR 0025):
 *
 * `rough` (no appetite) → `candidate` (sharp, no Shape yet) → `in_flight` (a
 * Shape that is not done) → `released` (its Shape reached done this cycle) →
 * `monitoring` (released, and nobody has resolved it) → `resolved` (a person
 * decided the problem is gone).
 */
export type FrameState =
  | 'rough'
  | 'candidate'
  | 'in_flight'
  | 'released'
  | 'monitoring'
  | 'resolved'

/** A Shape's lifecycle phase. Mirrors the cycle model's Stage (ADR 0023). */
export type ShapeStage = 'shaping' | 'building' | 'done'

/**
 * A Shape that points home to a frame. Passed in, because a frame never stores
 * its shape list — the list is read from the cycle rooms (ADR 0022). The engine
 * takes summaries so it stays free of Liveblocks.
 */
export type LinkedShape = {
  frameId: string
  shapeId: string
  title: string
  stage: ShapeStage
  cycleSlug: string
  cycleTitle: string
  /** True when this shape sits in the cycle that is current today. */
  currentCycle: boolean
}

/**
 * A frame is **sharp** when it has both a problem and an appetite. Derived,
 * never a stored flag, the same way the cycle phase is date-derived (ADR 0015).
 * Only a sharp frame can be bet on, so nobody bets on half a frame.
 */
export function isSharp(frame: Pick<Frame, 'problem' | 'appetite'>): boolean {
  return text(frame.problem) !== '' && text(frame.appetite) !== ''
}

/**
 * The sentence the map shows under a sharp frame. The app builds it from the
 * problem and the appetite, so nobody types it. null for a rough frame: there
 * is no commitment to state until an appetite exists.
 */
export function candidateStatement(
  frame: Pick<Frame, 'problem' | 'appetite'>
): string | null {
  if (!isSharp(frame)) return null
  return `If we can shape this into something doable in ${text(frame.appetite)}, that is meaningful to us.`
}

/**
 * A frame's state, from its appetite, its linked shapes and the resolved flag.
 * Nothing here is stored.
 */
export function frameState(
  frame: Pick<Frame, 'problem' | 'appetite' | 'resolved'>,
  shapes: LinkedShape[] = []
): FrameState {
  // A person's decision outranks every derivation. Nothing resolves on a timer.
  if (frame.resolved) return 'resolved'
  if (shapes.length > 0) {
    // One shape still moving means work is in flight, even beside an older
    // release: a frame can be attacked again years later (ADR 0022).
    if (shapes.some((s) => s.stage !== 'done')) return 'in_flight'
    // Every shape is done. `released` while the release is this cycle's news;
    // `monitoring` once it is not. Monitoring has no end condition, so only a
    // person moves a frame on from here (ADR 0025).
    return shapes.some((s) => s.currentCycle) ? 'released' : 'monitoring'
  }
  return isSharp(frame) ? 'candidate' : 'rough'
}

/** Stored strings outlive the code that wrote them, so read them defensively. */
function text(value: string | undefined): string {
  return (value ?? '').trim()
}

/**
 * Which reports count towards a pin's size. A frame has ONE freshness clock;
 * the lens only filters what feeds the size. A frame hot with customers and
 * cold internally is the most useful thing the map can show.
 */
export const HEAT_LENSES = ['all', 'internal', 'customer'] as const
export type HeatLens = (typeof HEAT_LENSES)[number]

export const DEFAULT_LENS: HeatLens = 'all'

export function isHeatLens(value: unknown): value is HeatLens {
  return (HEAT_LENSES as readonly unknown[]).includes(value)
}

/** How many of a frame's reports the lens lets through. */
export function reportCount(frame: Pick<Frame, 'reports'>, lens: HeatLens): number {
  const reports = frame.reports ?? []
  if (lens === 'all') return reports.length
  return reports.filter((r) => r.source === lens).length
}

// Size is the report count, so widespread pain looks bigger. Growth is by
// square root: ten reports must read as louder than one, not as ten dots wide,
// and the cap stops one shouty frame swallowing its area.
export const PIN_MIN_SIZE = 10
export const PIN_MAX_SIZE = 28
const PIN_SIZE_PER_ROOT = 6

/** A pin's diameter in pixels, from the report count under the active lens. */
export function pinSize(count: number): number {
  if (count <= 0) return PIN_MIN_SIZE
  return Math.min(PIN_MAX_SIZE, PIN_MIN_SIZE + Math.round(Math.sqrt(count) * PIN_SIZE_PER_ROOT))
}

/**
 * Everything the map and the frame detail draw for one frame. The **Pin** proper
 * is only the marker; the rest of these fields are the frame's own text, carried
 * here so the view derives nothing for itself.
 */
export type RenderedPin = {
  frameId: string
  areaId: string
  kind: FrameKind
  type: FrameType
  problem: string
  appetite: string
  businessCase: string
  /** Clerk user id of the frame owner, or null when nobody holds it. */
  owner: string | null
  /** Color is the Kind. The other three pin channels arrive with their tickets. */
  color: string
  /** Every report on the frame, unfiltered — the detail shows the evidence. */
  reports: FrameReport[]
  /** Reports that pass the active heat lens. Size reads this, nothing else. */
  reportCount: number
  /** Diameter in pixels. Size is the second pin channel. */
  size: number
  /** A problem AND an appetite. A rough pin must never look like agreed work. */
  sharp: boolean
  state: FrameState
  /** Built from the problem and the appetite. null for a rough frame. */
  candidateStatement: string | null
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
  /** Shapes that point home to a frame, read from the cycle rooms (ADR 0022). */
  shapes?: LinkedShape[]
  /** Which reports count towards pin size. Defaults to all of them. */
  lens?: HeatLens
}): ProductMapModel {
  const areas = input.areas ?? []
  const lens = input.lens ?? DEFAULT_LENS
  const shapesByFrame = groupShapesByFrame(input.shapes ?? [])
  // A resolved frame leaves the map: a person decided the problem is gone.
  // It is never deleted, so it stays readable through a filtered query.
  const pins = input.frames
    .filter((f) => !f.resolved)
    .map((f) => renderPin(f, input.today, shapesByFrame.get(f.id) ?? [], lens))

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

function renderPin(
  frame: Frame,
  today: string,
  shapes: LinkedShape[],
  lens: HeatLens
): RenderedPin {
  const kind = isFrameKind(frame.kind) ? frame.kind : DEFAULT_KIND
  const count = reportCount(frame, lens)
  return {
    frameId: frame.id,
    areaId: frame.areaId ?? '',
    kind,
    type: frame.type,
    problem: frame.problem,
    appetite: frame.appetite ?? '',
    businessCase: frame.business_case ?? '',
    owner: frame.owner ?? null,
    color: KIND_COLORS[kind],
    reports: frame.reports ?? [],
    reportCount: count,
    size: pinSize(count),
    sharp: isSharp(frame),
    state: frameState(frame, shapes),
    candidateStatement: candidateStatement(frame),
    daysSinceWoken: daysBetween(frame.last_woken, today),
  }
}

function groupShapesByFrame(shapes: LinkedShape[]): Map<string, LinkedShape[]> {
  const byFrame = new Map<string, LinkedShape[]>()
  for (const shape of shapes) {
    const bucket = byFrame.get(shape.frameId)
    if (bucket) bucket.push(shape)
    else byFrame.set(shape.frameId, [shape])
  }
  return byFrame
}

/** Whole days from `from` to `to`, both ISO calendar dates. null if either is unreadable. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}
