'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { listCycles } from '@/app/[slug]/cycles/actions'
import { CommandPalette } from './command-palette'
import type { PaletteCycleItem, PalettePitchItem } from './types'

type CommandPaletteContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  /** Org url slug, used to build cycle hrefs. */
  slug: string
  cycles: PaletteCycleItem[]
  cyclesLoading: boolean
  pitchItems: PalettePitchItem[]
  setPitchItems: (items: PalettePitchItem[]) => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
)

/**
 * Owns the command palette's open state, the ⌘K/Ctrl+K listener, the lazily
 * fetched cycle list, and the registry of current-cycle pitches pushed up by
 * whichever page has the room open. See docs/adr/0007-command-palette-registry.md.
 */
export function CommandPaletteProvider({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const [open, setOpenState] = useState(false)
  const [cycles, setCycles] = useState<PaletteCycleItem[] | null>(null)
  const [cyclesLoading, setCyclesLoading] = useState(false)
  const [pitchItems, setPitchItems] = useState<PalettePitchItem[]>([])

  // Lazy-fetch the cycle list once, on the open action — not as a render effect —
  // then cache it for the session. No page pays a getRooms call unless the
  // palette is actually opened.
  const fetchStarted = useRef(false)
  const ensureCycles = useCallback(() => {
    if (fetchStarted.current) return
    fetchStarted.current = true
    setCyclesLoading(true)
    listCycles()
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false))
  }, [])

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next)
      if (next) ensureCycles()
    },
    [ensureCycles]
  )

  // ⌘K (mac) / Ctrl+K (win/linux) toggles the palette anywhere under /[slug].
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!openRef.current)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      setOpen,
      slug,
      cycles: cycles ?? [],
      cyclesLoading,
      pitchItems,
      setPitchItems,
    }),
    [open, setOpen, slug, cycles, cyclesLoading, pitchItems]
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider'
    )
  }
  return ctx
}

/**
 * Register the current cycle's pitches into the palette while this component is
 * mounted; cleared on unmount. Callers should pass a memoized array. No-ops when
 * rendered outside the provider so room pages stay usable in isolation (tests,
 * Storybook).
 */
export function useRegisterPalettePitches(items: PalettePitchItem[]) {
  const ctx = useContext(CommandPaletteContext)
  const setPitchItems = ctx?.setPitchItems
  // Small lists — a stable key over the items keeps the effect from re-firing on
  // every render without forcing callers to over-memoize.
  const key = JSON.stringify(items)

  useEffect(() => {
    if (!setPitchItems) return
    setPitchItems(items)
    return () => setPitchItems([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setPitchItems])
}
