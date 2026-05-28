'use client'

import { useState } from 'react'
import type { Zone } from '@/cycle-liveblocks.config'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const ZONES: { value: Zone; label: string }[] = [
  { value: 'on_track', label: 'On track' },
  { value: 'some_risk', label: 'Some risk' },
  { value: 'concerned', label: 'Concerned' },
]

export type MoveNeedleModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekLabel: string
  dateLabel: string
  userName: string
  channelName: string
  onPost: (zone: Zone, narrative: string) => void | Promise<void>
}

export function MoveNeedleModal({
  open,
  onOpenChange,
  weekLabel,
  dateLabel,
  userName,
  channelName,
  onPost,
}: MoveNeedleModalProps) {
  const [zone, setZone] = useState<Zone | null>(null)
  const [narrative, setNarrative] = useState('')
  const [posting, setPosting] = useState(false)

  const canPost = zone !== null && narrative.trim().length > 0 && !posting

  async function handlePost() {
    if (!canPost || !zone) return
    setPosting(true)
    try {
      await onPost(zone, narrative.trim())
      setZone(null)
      setNarrative('')
      onOpenChange(false)
    } finally {
      setPosting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setZone(null)
      setNarrative('')
      setPosting(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[1.5px] border-foreground rounded-[14px] shadow-[8px_8px_0_0_hsl(var(--foreground))] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-gloria text-[28px]">
            Move the needle
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {weekLabel} · {dateLabel} · posting as {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div>
            <h3 className="font-gloria text-sm mb-3">
              How&apos;s the team feeling?
            </h3>
            <div className="flex gap-2">
              {ZONES.map((z) => (
                <button
                  key={z.value}
                  onClick={() => setZone(z.value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
                  style={{
                    borderColor:
                      zone === z.value ? ZONE_COLORS[z.value] : undefined,
                    backgroundColor:
                      zone === z.value
                        ? ZONE_COLORS[z.value] + '18'
                        : undefined,
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ZONE_COLORS[z.value] }}
                  />
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-gloria text-sm mb-2">
              What changed this week?
            </h3>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Ship something? Hit a wall? Learned something surprising?"
              className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => handleOpenChange(false)}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!canPost}
            className="px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium transition-opacity disabled:opacity-40"
          >
            {posting ? 'Posting...' : `Post to #${channelName}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
