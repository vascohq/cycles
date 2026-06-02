'use client'

import { useState } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { MiniNeedle } from '@/components/needle/mini-needle'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import { HillChart, type HillScope } from '@/components/hill-chart'
import type { TimelineCard } from '@/lib/timeline-helpers'
import type { HillSnapshot, Zone } from '@/cycle-liveblocks.config'
import { needleProgressNote } from '@/lib/slack-message'
import { useSlackEnabled } from '@/components/slack-config-context'
import { cn } from '@/lib/utils'

const ZONE_LABEL: Record<Zone, string> = {
  on_track: 'On track',
  some_risk: 'Some risk',
  concerned: 'Concerned',
}

function toHillScopes(snapshot: HillSnapshot[]): HillScope[] {
  // Snapshots predate the color field, so timeline mini-charts render dots in a
  // neutral color — the history view is about movement, not identity.
  return snapshot.map((h, i) => ({
    id: h.scopeId,
    title: h.title ?? '',
    tier: h.tier ?? ('should' as const),
    hill_progress: h.hill_progress,
    order: i + 1,
    color: '#9ca3af',
  }))
}
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
  const zone = card.needleSnapshot.zone
  const zoneChanged = card.previousZone !== null && card.previousZone !== zone
  const needleNote = needleProgressNote(
    card.previousNeedleProgress,
    card.needleSnapshot.progress
  )
  const hasHill = card.beforeSnapshot.length > 0 || card.afterSnapshot.length > 0
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Shared across this card's before/after charts: hovering a scope on one
  // highlights it on the other and fades the rest.
  const [highlightedScopeId, setHighlightedScopeId] = useState<string | null>(null)

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

        {/* Zone line — mirrors the Slack post: a transition when it changed. */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <MiniNeedle needle={card.needleSnapshot} />
          {zoneChanged && card.previousZone ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ZONE_COLORS[card.previousZone] }} />
              <span className="text-muted-foreground">→</span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ZONE_COLORS[zone] }} />
              <span style={{ color: ZONE_COLORS[zone] }}>Now {ZONE_LABEL[zone].toLowerCase()}</span>
              <span className="text-muted-foreground">(was {ZONE_LABEL[card.previousZone].toLowerCase()})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ZONE_COLORS[zone] }} />
              <span style={{ color: ZONE_COLORS[zone] }}>{ZONE_LABEL[zone]}</span>
            </span>
          )}
        </div>

        {needleNote && <div className="text-xs font-medium">{needleNote}</div>}

        {card.narrative && (
          <p className="text-[13.5px] leading-relaxed border-l-2 border-border pl-2">
            {card.narrative}
          </p>
        )}

        {card.movement && (
          <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
            {card.movement}
          </div>
        )}

        {hasHill && (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="rounded-lg border bg-muted/20 p-1.5">
              <div className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground mb-0.5 px-0.5">
                After
              </div>
              <HillChart
                scopes={toHillScopes(card.afterSnapshot)}
                dotRadius={6}
                highlightedScopeId={highlightedScopeId}
                onScopeHover={setHighlightedScopeId}
                fadeOthers
              />
            </div>
            <div className="rounded-lg border bg-muted/20 p-1.5">
              <div className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground mb-0.5 px-0.5">
                Before
              </div>
              <HillChart
                scopes={toHillScopes(card.beforeSnapshot)}
                dotRadius={6}
                highlightedScopeId={highlightedScopeId}
                onScopeHover={setHighlightedScopeId}
                fadeOthers
              />
            </div>
          </div>
        )}

        <div className="text-[11px] font-mono text-muted-foreground">
          Week {card.weekNumber} of {card.totalWeeks} · {card.daysLeft} days left
        </div>

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

