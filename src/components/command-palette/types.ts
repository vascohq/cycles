import type { Stage, Zone } from '@/cycle-liveblocks.config'

/** A cycle as listed in the command palette, fetched server-side from room metadata. */
export type PaletteCycleItem = {
  slug: string
  title: string
  type: 'build' | 'cooldown'
  start_date: string
  end_date: string
}

/**
 * A pitch registered into the palette by whichever page currently has the cycle
 * room open (Mission Control / Scope Map). Pitches live only inside Liveblocks
 * room storage, so they can only be offered while a room is open — see
 * docs/adr/0007-command-palette-registry.md.
 */
export type PalettePitchItem = {
  id: string
  title: string
  /** Identity emoji, or '' when unset. */
  emoji: string
  stage: Stage
  zone: Zone | null
  href: string
}
