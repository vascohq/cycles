import type { FrameKind, FrameType } from '@/product-map-liveblocks.config'
import type { Freshness } from '@/lib/frame-list'
import type { FrameState } from '@/lib/product-map-engine'

// Labels are the only place these vocabularies get prose. The stored values
// stay machine-readable, because MCP callers filter on them.

export const KIND_LABELS: Record<FrameKind, string> = {
  brand_burn: 'Brand burn',
  pain_point: 'Pain point',
  unlock_win: 'Win to unlock',
}

export const TYPE_LABELS: Record<FrameType, string> = {
  bug: 'Bug',
  idea: 'Idea',
  request: 'Request',
  security: 'Security',
  irritant: 'Irritant',
}

export const STATE_LABELS: Record<FrameState, string> = {
  rough: 'Rough',
  candidate: 'Candidate',
  in_flight: 'In flight',
  released: 'Released',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  top_of_mind: 'Top of mind',
  cooling: 'Cooling',
  fading: 'Fading',
}
