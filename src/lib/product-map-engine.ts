// Pure engine for the Product Map. It takes the frames and the team's "today"
// (ISO date string, resolved in the team timezone — see team-time.ts) and
// returns the rendered map model. No React, no Liveblocks, no clock of its own,
// the same shape as the cycle list engine.

import type { Frame, FrameKind, FrameType } from '@/product-map-liveblocks.config'

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

export type ProductMapModel = {
  pins: RenderedPin[]
}

export function renderProductMap(input: {
  frames: Frame[]
  today: string
}): ProductMapModel {
  return {
    // A resolved frame leaves the map: a person decided the problem is gone.
    // It is never deleted, so it stays readable through a filtered query.
    pins: input.frames.filter((f) => !f.resolved).map((f) => renderPin(f, input.today)),
  }
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
