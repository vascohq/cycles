'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveSquadByName, type SquadLike } from '@/lib/squad-engine'

type SquadPickerProps = {
  squads: SquadLike[]
  currentSquadId?: string
  onAssign: (name: string) => void
  onClear: () => void
}

/**
 * Inline squad picker for the Scope Map hero: shows the assigned squad as a
 * colored chip, and opens a small panel to select an existing squad or type a
 * new name to create one (assignment goes through the shared squad-engine, so
 * "Platform" and "platform" resolve to the same squad).
 */
export function SquadPicker({
  squads,
  currentSquadId,
  onAssign,
  onClear,
}: SquadPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const current = squads.find((s) => s.id === currentSquadId) ?? null

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const trimmed = query.trim()
  const filtered = trimmed
    ? squads.filter((s) => s.name.toLowerCase().includes(trimmed.toLowerCase()))
    : squads
  // Offer "create" only when the typed name doesn't resolve to an existing squad.
  const canCreate = trimmed.length > 0 && !resolveSquadByName(squads, trimmed)

  function assign(name: string) {
    onAssign(name)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
        aria-label="Assign squad"
      >
        {current ? (
          <>
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: current.color }}
            />
            <span className="font-medium">{current.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">+ Squad</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find or create a squad…"
            className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) assign(trimmed)
            }}
          />
          <div className="mt-1 max-h-56 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => assign(s.name)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  s.id === currentSquadId ? 'bg-muted' : ''
                }`}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.name}</span>
              </button>
            ))}

            {canCreate && (
              <button
                type="button"
                onClick={() => assign(trimmed)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="text-muted-foreground">Create</span>
                <span className="font-medium">“{trimmed}”</span>
              </button>
            )}

            {current && (
              <button
                type="button"
                onClick={() => {
                  onClear()
                  setQuery('')
                  setOpen(false)
                }}
                className="mt-1 flex w-full items-center rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Clear squad
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
