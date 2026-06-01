'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HillChart, type HillScope } from './hill-chart'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import type { HillHistoryFrame } from '@/lib/scope-map-helpers'

type HillHistoryProps = {
  // Live (latest) frame — draggable when onHillProgressChange is provided.
  scopes: HillScope[]
  trails?: ScopeTrail[]
  // Past posted updates, newest first (see buildHillHistoryFrames).
  history?: HillHistoryFrame[]
  highlightedScopeId?: string | null
  onScopeHover?: (scopeId: string | null) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
}

function formatFrameDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Wraps HillChart with prev/next arrows to scrub back through past updates
// (Hill History). Index 0 is LIVE; 1..N are historical frames (newest → oldest).
// HillChart stays purely a renderer — this owns the scrubbing state and decides
// whether the frame is draggable (live) or read-only (historical).
export function HillHistory({
  scopes,
  trails = [],
  history = [],
  highlightedScopeId,
  onScopeHover,
  onHillProgressChange,
}: HillHistoryProps) {
  // 0 = live; 1..history.length = historical frames (newest first).
  const [index, setIndex] = useState(0)

  // Clamp in case the history list shrinks (e.g. an update is removed) while a
  // historical frame is being viewed.
  const clamped = Math.min(index, history.length)
  const isLive = clamped === 0
  const frame = isLive ? null : history[clamped - 1]

  const canOlder = clamped < history.length
  const canNewer = clamped > 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1 min-h-[28px]">
        <button
          type="button"
          aria-label="Older update"
          disabled={!canOlder}
          onClick={() => setIndex((i) => Math.min(i + 1, history.length))}
          className="flex items-center justify-center rounded-full border w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-xs text-center text-muted-foreground">
          {isLive ? (
            <span className="font-medium">Live</span>
          ) : (
            <span>
              <span className="font-medium text-foreground">
                {formatFrameDate(frame!.postedAt)}
              </span>{' '}
              · {frame!.authorName}
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label="Newer update"
          disabled={!canNewer}
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          className="flex items-center justify-center rounded-full border w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <HillChart
        scopes={isLive ? scopes : frame!.scopes}
        trails={isLive ? trails : frame!.trails}
        highlightedScopeId={highlightedScopeId}
        onScopeHover={onScopeHover}
        // Historical frames are read-only: omit the change handler so HillChart
        // disables dragging. Returning to Live re-enables editing.
        onHillProgressChange={isLive ? onHillProgressChange : undefined}
      />
    </div>
  )
}
