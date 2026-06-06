'use client'

import { Search } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useCommandPalette } from './command-palette-context'

const subscribe = () => () => {}

export function CommandSearchButton() {
  const { setOpen } = useCommandPalette()
  // Platform is a client-only value; useSyncExternalStore gives the server
  // snapshot (mac) during SSR then the real value after hydration — no
  // setState-in-effect, no hydration warning.
  const isMac = useSyncExternalStore(
    subscribe,
    () => /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    () => true
  )

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      aria-label="Search cycles and pitches"
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-sans text-[10px] sm:inline-flex">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  )
}
