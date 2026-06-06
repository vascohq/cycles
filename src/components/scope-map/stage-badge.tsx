'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Stage } from '@/cycle-liveblocks.config'
import { nextStage, prevStage } from '@/lib/stage-engine'

// The pitch's current Stage shown as a compact badge (styled like the squad
// badge), with arrows on either side that step it back/forward one stage. No
// dropdown — the arrows are the whole interaction. An arrow is hidden at the
// ends (no back arrow while framing, no forward arrow once done); the label
// keeps its own padding so it never looks cramped when an arrow is absent.
export function StageBadge({
  stage,
  onChange,
}: {
  stage: Stage
  onChange: (stage: Stage) => void
}) {
  const prev = prevStage(stage)
  const next = nextStage(stage)
  const arrowClass =
    'flex items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border bg-background px-1 py-1 text-xs font-medium">
      {prev && (
        <button
          type="button"
          onClick={() => onChange(prev)}
          aria-label={`Move back to ${prev}`}
          title={`Move back to ${prev}`}
          className={arrowClass}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Pad the side that has no arrow so the label never hugs the edge. */}
      <span className={`capitalize ${prev ? 'pl-1' : 'pl-2'} ${next ? 'pr-1' : 'pr-2'}`}>
        {stage}
      </span>
      {next && (
        <button
          type="button"
          onClick={() => onChange(next)}
          aria-label={`Advance to ${next}`}
          title={`Advance to ${next}`}
          className={arrowClass}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
