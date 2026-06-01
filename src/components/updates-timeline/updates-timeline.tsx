'use client'

import { useState } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { MiniNeedle } from '@/components/needle/mini-needle'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import type { TimelineCard } from '@/lib/timeline-helpers'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import { useSlackEnabled } from '@/components/slack-config-context'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export type UpdatesTimelineProps = {
  cards: TimelineCard[]
  onRetrySlack?: (updateId: string) => void
  onDeleteUpdate?: (updateId: string) => void
}

export function UpdatesTimeline({
  cards,
  onRetrySlack,
  onDeleteUpdate,
}: UpdatesTimelineProps) {
  const slackEnabled = useSlackEnabled()
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Updates</h2>
        {slackEnabled && (
          <p className="text-xs font-mono text-muted-foreground">
            Posted to Slack
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          No updates yet — click &ldquo;Move the needle&rdquo; to post the first one
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => (
            <UpdateCard
              key={card.id}
              card={card}
              isNewest={i === 0}
              onRetrySlack={onRetrySlack}
              onDeleteUpdate={i === 0 ? onDeleteUpdate : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function UpdateCard({
  card,
  isNewest,
  onRetrySlack,
  onDeleteUpdate,
}: {
  card: TimelineCard
  isNewest: boolean
  onRetrySlack?: (updateId: string) => void
  onDeleteUpdate?: (updateId: string) => void
}) {
  const zoneLabel = card.needleSnapshot.zone.replace('_', ' ')
  const zoneColor = ZONE_COLORS[card.needleSnapshot.zone]
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div
      className={cn(
        'grid gap-3 rounded-xl border bg-card p-4',
        isNewest && 'animate-in fade-in slide-in-from-bottom-1'
      )}
      style={{ gridTemplateColumns: '42px 1fr' }}
    >
      <div
        className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0"
        style={{ border: '1.5px solid hsl(var(--foreground))' }}
      >
        <span className="text-xs font-semibold">{card.authorInitials}</span>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{card.authorName}</span>
          <span className="text-xs font-mono text-muted-foreground">
            {card.formattedTimestamp}
          </span>
          {onDeleteUpdate && (
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Update actions"
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => setConfirmOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DeleteUpdateDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={() => {
                  onDeleteUpdate(card.id)
                  setConfirmOpen(false)
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <MiniNeedle needle={card.needleSnapshot} />
          <span
            className="text-xs font-medium"
            style={{ color: zoneColor }}
          >
            {zoneLabel.charAt(0).toUpperCase() + zoneLabel.slice(1)}
          </span>
          <RollupSummary card={card} />
        </div>

        <p className="text-[13.5px] leading-relaxed">{card.narrative}</p>

        <HillMovement card={card} />

        {card.slackFailed && onRetrySlack && (
          <button
            onClick={() => onRetrySlack(card.id)}
            className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 font-mono transition-colors"
          >
            Slack post failed — retry?
          </button>
        )}
      </div>
    </div>
  )
}

// Confirms deleting the latest update — a misfire undo (see ADR 0006). Spells
// out the two consequences: the needle reverts, and the Slack message stays.
function DeleteUpdateDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            Delete this update?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The needle will revert to the previous update. This won&apos;t remove
          the message already posted to Slack. This can&apos;t be undone.
        </p>
        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium transition-opacity"
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Compact rollup of the frozen movement, shown beside the needle. Counts come
// straight from the engine's rollup over stored snapshots.
function RollupSummary({ card }: { card: TimelineCard }) {
  const { moved, stalled, new: added, dropped } = card.rollup
  const parts: string[] = []
  if (moved > 0) parts.push(`${moved} moved`)
  if (added > 0) parts.push(`${added} new`)
  if (stalled > 0) parts.push(`${stalled} stalled`)
  if (dropped > 0) parts.push(`${dropped} dropped`)
  if (parts.length === 0) return null
  return (
    <span className="text-xs font-mono text-muted-foreground">
      {parts.join(' · ')}
    </span>
  )
}

// Frozen per-scope trail list for this update. Reads only from card.trails,
// which were computed from STORED snapshots — never from live positions.
function HillMovement({ card }: { card: TimelineCard }) {
  if (card.trails.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 border-t pt-2">
      {card.trails.map((trail) => (
        <li
          key={trail.scopeId}
          className="flex items-center gap-2 text-xs min-w-0"
        >
          <span className="truncate text-muted-foreground">
            {scopeLabel(trail, card.scopeTitles)}
          </span>
          <span
            className="font-medium shrink-0"
            style={{ color: trailLabelColor(trail) }}
          >
            {trailDetail(trail)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function scopeLabel(
  trail: ScopeTrail,
  titles: Record<string, string>
): string {
  if (trail.state === 'dropped' && trail.title) return trail.title
  return titles[trail.scopeId] ?? trail.scopeId
}

function trailDetail(trail: ScopeTrail): string {
  if ('stepDelta' in trail && trail.stepDelta !== 0) {
    const sign = trail.stepDelta > 0 ? '+' : ''
    const unit = Math.abs(trail.stepDelta) === 1 ? 'step' : 'steps'
    return `${trail.label} · ${sign}${trail.stepDelta} ${unit}`
  }
  return trail.label
}

// Color reads from geometry/direction only — never an alarm. Forward progress
// is positive (foreground), regression is muted, neutral states stay quiet.
function trailLabelColor(trail: ScopeTrail): string {
  switch (trail.label) {
    case 'Over the hill':
    case 'Lots of progress':
    case 'Nudged forward':
    case 'New':
      return 'hsl(var(--foreground))'
    default:
      return 'hsl(var(--muted-foreground))'
  }
}
