// Pure logic for Squads (see ADR 0009). No React, no storage.
import { slugify } from './slugify'
import { assignScopeColor } from './color-engine'

export type SquadLike = { id: string; name: string; color: string }

/**
 * Pick a unique identity color for a new squad, given the colors already used
 * by sibling squads. Squad Color is its own concept but shares the curated
 * palette and deterministic assignment with Scope Color (see CONTEXT.md).
 */
export function assignSquadColor(usedColors: string[]): string {
  return assignScopeColor(usedColors)
}

/**
 * Normalized dedup key for a squad name. Two names that slugify to the same key
 * are the same squad ("Platform", "platform", "  PLATFORM  " → "platform").
 */
export function squadKey(name: string): string {
  return slugify(name)
}

/**
 * Find a squad by name, matched on its normalized key (case-insensitive,
 * whitespace/punctuation-insensitive). Returns the matching squad or null.
 */
export function resolveSquadByName<T extends SquadLike>(
  squads: T[],
  name: string
): T | null {
  const key = squadKey(name)
  return squads.find((s) => squadKey(s.name) === key) ?? null
}
