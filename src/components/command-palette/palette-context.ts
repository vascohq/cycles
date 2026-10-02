'use client'

import { createContext, useContext } from 'react'
import type { PaletteCycleItem, PalettePitchItem } from './types'

// The context lives apart from its provider: the provider imports a server
// action, and anything that only reads the context (the breadcrumb cycle menu,
// rendered in Storybook) must not pull that action into a browser bundle.
export type CommandPaletteContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  /** Org url slug, used to build cycle hrefs. */
  slug: string
  cycles: PaletteCycleItem[]
  cyclesLoading: boolean
  pitchItems: PalettePitchItem[]
  setPitchItems: (items: PalettePitchItem[]) => void
  /** Starts the one cycle-list fetch, shared with the breadcrumb cycle menu. */
  ensureCycles: () => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
)

/**
 * The palette's cached cycle list, or null outside the provider (Storybook, the
 * e2e fixtures). Never throws, so a component can degrade instead.
 */
export function useCycleList() {
  return useContext(CommandPaletteContext)
}
