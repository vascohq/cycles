'use client'

import { useState } from 'react'
import type { Zone } from '@/cycle-liveblocks.config'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import { HillChart, type HillScope } from '@/components/hill-chart'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import { NeedleControl } from '@/components/needle'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useSlackEnabled } from '@/components/slack-config-context'
import { SlackPreview } from './slack-preview'

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
  pitchTitle: string
  tasksDone: number
  tasksTotal: number
  daysLeft: number
  currentProgress: number
  currentZone: Zone | null
  /** Live scopes for the read-only hill diff (since the last update). */
  hillScopes?: HillScope[]
  /** Trails computed by the Hill Trail engine — drives the read-only diff. */
  hillTrails?: ScopeTrail[]
  onPost: (progress: number, zone: Zone, narrative: string) => void | Promise<void>
}

export function MoveNeedleModal({
  open,
  onOpenChange,
  weekLabel,
  dateLabel,
  userName,
  pitchTitle,
  tasksDone,
  tasksTotal,
  daysLeft,
  currentProgress,
  currentZone,
  hillScopes = [],
  hillTrails = [],
  onPost,
}: MoveNeedleModalProps) {
  const slackEnabled = useSlackEnabled()
  const showHillDiff = hillTrails.length > 0
  const [progress, setProgress] = useState(currentProgress)
  const [zone, setZone] = useState<Zone | null>(currentZone)
  const [narrative, setNarrative] = useState('')
  const [posting, setPosting] = useState(false)

  // Pre-fill position and zone from the current needle each time the modal opens,
  // so you adjust from where it is rather than from a blank slate.
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setProgress(currentProgress)
    setZone(currentZone)
    setNarrative('')
    setPosting(false)
  }
  if (open !== prevOpen) setPrevOpen(open)

  const canPost = zone !== null && narrative.trim().length > 0 && !posting

  async function handlePost() {
    if (!canPost || !zone) return
    setPosting(true)
    try {
      await onPost(progress, zone, narrative.trim())
      onOpenChange(false)
    } finally {
      setPosting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={showHillDiff ? 'max-w-2xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Move the needle
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {weekLabel} · {dateLabel} · posting as {userName}
          </DialogDescription>
        </DialogHeader>

        <div
          className={
            showHillDiff
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-6 py-2'
              : 'flex flex-col gap-5 py-2'
          }
        >
          <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-medium mb-1">How far along?</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Drag the handle, click the arc, or use the arrow keys.
            </p>
            <div className="flex justify-center">
              <NeedleControl
                progress={progress}
                zone={zone}
                onChange={setProgress}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">
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
            <h3 className="text-sm font-medium mb-2">
              What changed this week?
            </h3>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Ship something? Hit a wall? Learned something surprising?"
              className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {slackEnabled && (
            <SlackPreview
              pitchTitle={pitchTitle}
              weekLabel={weekLabel}
              zone={zone}
              narrative={narrative}
              tasksDone={tasksDone}
              tasksTotal={tasksTotal}
              daysLeft={daysLeft}
            />
          )}
          </div>

          {showHillDiff && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                What moved on the hill?
              </h3>
              {/* Read-only diff: no onHillProgressChange => not draggable.
                  Reuses the Hill Trail engine via the trails prop; the count
                  rollup renders for free below the chart. */}
              <HillChart scopes={hillScopes} trails={hillTrails} />
            </div>
          )}
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
            {posting ? 'Posting…' : slackEnabled ? 'Post to Slack' : 'Post update'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
