'use client'

import { useState } from 'react'
import type { Zone, NeedleSnapshot } from '@/cycle-liveblocks.config'
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
import { snapNeedleProgress } from '@/lib/needle-engine'
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
  daysLeft: number
  currentProgress: number
  currentZone: Zone | null
  /** Zone at the last update — drives the preview's zone-transition line. */
  previousZone?: Zone | null
  /** Needle position at the last update — drives the progress celebration. */
  previousNeedleProgress?: number | null
  /** The needle's last-update snapshot — shown as a ghost on the control. */
  ghost?: NeedleSnapshot | null
  /** Pre-computed hill-movement summary for the Slack preview. */
  movementPreview?: string | null
  /** Live scopes for the read-only hill diff (since the last update). */
  hillScopes?: HillScope[]
  /** Scope positions at the last update — the "before" hill. */
  previousHillScopes?: HillScope[]
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
  daysLeft,
  currentProgress,
  currentZone,
  previousZone = null,
  previousNeedleProgress = null,
  ghost = null,
  movementPreview = null,
  hillScopes = [],
  previousHillScopes = [],
  hillTrails = [],
  onPost,
}: MoveNeedleModalProps) {
  const slackEnabled = useSlackEnabled()
  const showHillDiff = hillTrails.length > 0
  const [progress, setProgress] = useState(() => snapNeedleProgress(currentProgress))
  const [zone, setZone] = useState<Zone | null>(currentZone)
  const [narrative, setNarrative] = useState('')
  const [posting, setPosting] = useState(false)
  // Shared across the before/after charts so hovering a scope on one highlights
  // it on the other (and fades the rest) to compare its position.
  const [highlightedScopeId, setHighlightedScopeId] = useState<string | null>(null)

  // Pre-fill position and zone from the current needle each time the modal opens,
  // so you adjust from where it is rather than from a blank slate. Snap the
  // position so it lands on a step (the needle's default sits just off-grid).
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setProgress(snapNeedleProgress(currentProgress))
    setZone(currentZone)
    setNarrative('')
    setPosting(false)
    setHighlightedScopeId(null)
  }
  if (open !== prevOpen) setPrevOpen(open)

  // Narrative is optional — choosing a zone is all it takes to move the needle.
  const canPost = zone !== null && !posting

  // Live position readout vs. the last update (compared in whole percent).
  const pct = Math.round(progress * 100)
  const lastPct =
    previousNeedleProgress !== null ? Math.round(previousNeedleProgress * 100) : null
  const delta = lastPct !== null ? pct - lastPct : null
  const movedFromLast = lastPct !== null && pct !== lastPct

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

  // A right-hand column exists whenever there's something to show alongside the
  // inputs — the hill diff and/or the Slack preview. Without it, stay compact.
  const hasAside = showHillDiff || slackEnabled

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          (hasAside ? 'max-w-4xl ' : 'max-w-md ') +
          'max-h-[88vh] flex flex-col'
        }
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Move the needle
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {weekLabel} · {dateLabel} · posting as {userName}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body so the post action stays pinned in the footer. */}
        <div
          className={
            (hasAside
              ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6'
              : 'flex flex-col gap-6') + ' flex-1 overflow-y-auto py-2 px-1 min-h-0'
          }
        >
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium mb-1">How far along?</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Drag the handle, click the arc, or use the arrow keys.
              </p>
              <div className="flex justify-center">
                <NeedleControl
                  progress={progress}
                  zone={zone}
                  ghost={ghost}
                  onChange={setProgress}
                />
              </div>

              <div className="flex items-center justify-center gap-3 mt-1 text-xs">
                <span className="font-semibold tabular-nums text-sm">{pct}%</span>
                {delta !== null && (
                  <span
                    className={
                      delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }
                  >
                    {delta === 0
                      ? 'No change since last update'
                      : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}% since last update`}
                  </span>
                )}
                {movedFromLast && (
                  <button
                    type="button"
                    onClick={() => setProgress(snapNeedleProgress(previousNeedleProgress!))}
                    className="text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">
                How&apos;s the team feeling?
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {ZONES.map((z) => (
                  <button
                    key={z.value}
                    onClick={() => setZone(z.value)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
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
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: ZONE_COLORS[z.value] }}
                    />
                    {z.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col flex-1">
              <h3 className="text-sm font-medium mb-2">
                Anything to add?{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </h3>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Ship something? Hit a wall? Learned something surprising?"
                className="w-full flex-1 min-h-[120px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* What you're posting: hill movement + Slack preview */}
          {hasAside && (
            <div className="flex flex-col gap-6">
              {showHillDiff && (
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    What moved on the hill?
                  </h3>
                  {/* Plain-language summary first, then an explicit before/after
                      so the movement reads at a glance (charts are read-only). */}
                  {movementPreview && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line mb-3 leading-relaxed">
                      {movementPreview}
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1 px-1">
                        After · now
                      </div>
                      <HillChart
                        scopes={hillScopes}
                        trails={hillTrails}
                        dotRadius={7}
                        highlightedScopeId={highlightedScopeId}
                        onScopeHover={setHighlightedScopeId}
                        fadeOthers
                      />
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1 px-1">
                        Before · last update
                      </div>
                      <HillChart
                        scopes={previousHillScopes}
                        dotRadius={7}
                        highlightedScopeId={highlightedScopeId}
                        onScopeHover={setHighlightedScopeId}
                        fadeOthers
                      />
                    </div>
                  </div>
                </div>
              )}

              {slackEnabled && (
                <SlackPreview
                  pitchTitle={pitchTitle}
                  weekLabel={weekLabel}
                  zone={zone}
                  previousZone={previousZone}
                  narrative={narrative}
                  movement={movementPreview}
                  needleProgress={progress}
                  previousNeedleProgress={previousNeedleProgress}
                  authorName={userName}
                  daysLeft={daysLeft}
                />
              )}
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
