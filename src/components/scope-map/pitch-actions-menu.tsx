'use client'

import { useState } from 'react'
import { MoreHorizontal, ArrowRightLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useCycleList } from '@/components/command-palette/palette-context'

/**
 * The pitch's "..." menu on the Scope Map. Its one action moves the pitch to
 * another cycle (ADR 0031). The cycle list is the palette's, fetched on first
 * open. `onMoveToCycle` resolves to an error message, or null once the move is
 * done and the caller is navigating away.
 */
export function PitchActionsMenu({
  cycleSlug,
  pitchTitle,
  onMoveToCycle,
}: {
  cycleSlug: string
  pitchTitle: string
  onMoveToCycle: (targetCycleSlug: string) => Promise<string | null>
}) {
  const cycleList = useCycleList()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Archived cycles are out of the way on purpose (ADR 0019); moving a pitch
  // into one would hide it.
  const targets = (cycleList?.cycles ?? []).filter((c) => !c.archived && c.slug !== cycleSlug)

  function openDialog() {
    cycleList?.ensureCycles()
    setTarget('')
    setError(null)
    setOpen(true)
  }

  async function move() {
    setPending(true)
    setError(null)
    const failure = await onMoveToCycle(target)
    if (failure) {
      setError(failure)
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Pitch actions"
            className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={openDialog}>
            <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
            Move to cycle…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reversible (move it back), so a plain confirm — no destructive red. */}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move “{pitchTitle}” to another cycle</DialogTitle>
            <DialogDescription>
              Its scopes, cards, updates and parking items move with it. Its squad
              is matched by name in the new cycle, and created there if missing.
            </DialogDescription>
          </DialogHeader>

          {cycleList?.cyclesLoading && targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading cycles…</p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">There is no other cycle to move it to.</p>
          ) : (
            <Select value={target} onValueChange={setTarget} disabled={pending}>
              <SelectTrigger aria-label="Target cycle">
                <SelectValue placeholder="Choose a cycle" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={move} disabled={!target || pending}>
              {pending ? 'Moving…' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
