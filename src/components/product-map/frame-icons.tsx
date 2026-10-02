import {
  Annoyed,
  Bug,
  Flame,
  HeartCrack,
  Lightbulb,
  LockOpen,
  MessageSquareQuote,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

import { KIND_COLORS } from '@/lib/product-map-engine'
import type { FrameKind, FrameType } from '@/product-map-liveblocks.config'

/**
 * One icon per Type, for lists, pickers and tooltips. Never on the land itself:
 * a pin carries four channels and Type is not one of them (ADR 0025).
 */
export const TYPE_ICONS: Record<FrameType, LucideIcon> = {
  bug: Bug,
  idea: Lightbulb,
  request: MessageSquareQuote,
  security: ShieldAlert,
  irritant: Annoyed,
}

/**
 * The Type as an icon, in the Kind's color. A rough frame draws faint, the way
 * a rough pin draws hollow, so it never looks like agreed work.
 */
export function TypeIcon({
  type,
  color,
  sharp = true,
  label,
  className = '',
}: {
  type: FrameType
  color: string
  sharp?: boolean
  label: string
  className?: string
}) {
  const Icon = TYPE_ICONS[type]
  return (
    <Icon
      aria-label={label}
      className={`shrink-0 ${sharp ? '' : 'opacity-50'} ${className}`}
      style={{ color }}
    />
  )
}

/** One icon per Kind, always in the Kind's own color. */
export const KIND_ICONS: Record<FrameKind, LucideIcon> = {
  brand_burn: Flame,
  pain_point: HeartCrack,
  unlock_win: LockOpen,
}

export function KindIcon({
  kind,
  label,
  className = '',
}: {
  kind: FrameKind
  label: string
  className?: string
}) {
  const Icon = KIND_ICONS[kind]
  return (
    <Icon
      aria-label={label}
      className={`shrink-0 ${className}`}
      style={{ color: KIND_COLORS[kind] }}
    />
  )
}
