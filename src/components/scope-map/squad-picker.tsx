'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  resolveSquadByName,
  isSquadNameTaken,
  type SquadLike,
} from '@/lib/squad-engine'
import { ColorPicker } from '@/components/color-picker'

type SquadPickerProps = {
  squads: SquadLike[]
  currentSquadId?: string
  onAssign: (name: string) => void
  onClear: () => void
  /** Cycle-wide pitch count per squad id — drives the delete blast-radius copy. */
  pitchCounts?: Record<string, number>
  /** Management handlers. When provided, rows reveal rename/recolor/delete. */
  onRenameSquad?: (squadId: string, name: string) => void
  onRecolorSquad?: (squadId: string, color: string) => void
  onDeleteSquad?: (squadId: string) => void
}

/**
 * Inline squad picker for the Scope Map hero: shows the assigned squad as a
 * colored chip, and opens a small panel to select an existing squad or type a
 * new name to create one (assignment goes through the shared squad-engine, so
 * "Platform" and "platform" resolve to the same squad). When management
 * handlers are supplied, each row reveals rename (inline, with collision
 * validation), recolor (palette only), and delete (behind a blast-radius
 * confirm) affordances.
 */
export function SquadPicker({
  squads,
  currentSquadId,
  onAssign,
  onClear,
  pitchCounts,
  onRenameSquad,
  onRecolorSquad,
  onDeleteSquad,
}: SquadPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const current = squads.find((s) => s.id === currentSquadId) ?? null
  const canManage = Boolean(onRenameSquad || onRecolorSquad || onDeleteSquad)

  function resetManage() {
    setEditingId(null)
    setConfirmingId(null)
    setDraftName('')
    setNameError(null)
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        resetManage()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId || confirmingId) resetManage()
        else setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, editingId, confirmingId])

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

  function startEdit(s: SquadLike) {
    setConfirmingId(null)
    setEditingId(s.id)
    setDraftName(s.name)
    setNameError(null)
  }

  function commitRename(s: SquadLike) {
    const next = draftName.trim()
    // Empty reverts (no-op); a collision is rejected with inline validation.
    if (!next || next === s.name) {
      resetManage()
      return
    }
    if (isSquadNameTaken(squads, next, s.id)) {
      setNameError('A squad with that name already exists')
      return
    }
    onRenameSquad?.(s.id, next)
    resetManage()
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
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
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
          <div className="mt-1 max-h-72 overflow-y-auto">
            {filtered.map((s) => {
              if (confirmingId === s.id) {
                const count = pitchCounts?.[s.id] ?? 0
                return (
                  <div key={s.id} className="rounded px-2 py-1.5 text-sm">
                    <p className="text-xs text-muted-foreground">
                      Delete “{s.name}”?{' '}
                      {count > 0 ? (
                        <>
                          {count} {count === 1 ? 'pitch' : 'pitches'} → Unassigned
                        </>
                      ) : (
                        'No pitches assigned'
                      )}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetManage}
                        className="rounded px-2 py-1 text-xs hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSquad?.(s.id)
                          resetManage()
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              }

              if (editingId === s.id) {
                const usedColors = squads
                  .filter((x) => x.id !== s.id)
                  .map((x) => x.color)
                return (
                  <div key={s.id} className="rounded px-2 py-1.5">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value)
                        if (nameError) setNameError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(s)
                      }}
                      onBlur={() => commitRename(s)}
                      className="w-full bg-transparent text-sm outline-none border-b border-border pb-1"
                    />
                    {nameError && (
                      <p className="mt-1 text-xs text-destructive">{nameError}</p>
                    )}
                    {onRecolorSquad && (
                      <div className="mt-2">
                        <ColorPicker
                          value={s.color}
                          usedColors={usedColors}
                          onPick={(color) => onRecolorSquad(s.id, color)}
                        />
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div
                  key={s.id}
                  className={`group/squad flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted ${
                    s.id === currentSquadId ? 'bg-muted' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => assign(s.name)}
                    className="flex flex-1 items-center gap-2 min-w-0 text-left"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                  </button>
                  {canManage && (
                    <span className="flex items-center gap-0.5 opacity-0 group-hover/squad:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      {(onRenameSquad || onRecolorSquad) && (
                        <button
                          type="button"
                          aria-label={`Edit ${s.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(s)
                          }}
                          className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {onDeleteSquad && (
                        <button
                          type="button"
                          aria-label={`Delete ${s.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(null)
                            setConfirmingId(s.id)
                          }}
                          className="p-0.5 rounded text-muted-foreground/60 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )
            })}

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
