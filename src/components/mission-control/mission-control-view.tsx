'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { MiniNeedle } from '@/components/needle/mini-needle'
import { TimeboxTape, CalendarOverlayRow } from '@/components/timebox'
import { computeTimebox } from '@/lib/timebox-engine'
import { positionBands } from '@/lib/calendar/overlay-positioning'
import type { OverlayBand } from '@/lib/calendar/ics-normalizer'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { PitchCard, SquadSection } from '@/lib/mission-control-helpers'
import {
  sectionKey,
  filterSquadSections,
} from '@/lib/mission-control-helpers'
import type { Stage } from '@/cycle-liveblocks.config'
import { useSlackEnabled } from '@/components/slack-config-context'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/slugify'

const STAGE_BADGE_STYLES: Record<Stage, string> = {
  framing: 'bg-muted text-muted-foreground',
  shaping: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  building: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  done: 'bg-foreground text-background',
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `Updated ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Updated ${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `Updated ${days}d ago`
}

export type MissionControlViewProps = {
  slug: string
  cycleSlug: string
  cycleTitle: string
  today: string
  sections: SquadSection[]
  onCreatePitch?: (title: string) => void
  /** The cycle window's boundaries (see ADR 0010). Omitted = not yet set. */
  cycleStart?: string
  cycleEnd?: string
  /** Calendar overlay bands (Holidays / Time Off) for the cycle window. */
  cycleBands?: OverlayBand[]
}

export function MissionControlView({
  slug,
  cycleSlug,
  cycleTitle,
  today,
  sections,
  onCreatePitch,
  cycleStart,
  cycleEnd,
  cycleBands,
}: MissionControlViewProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const slackEnabled = useSlackEnabled()
  const isEmpty = sections.length === 0
  // Show the filter only when there's more than one section to choose between.
  const showFilter = sections.length > 1
  const visibleSections = filterSquadSections(sections, activeFilter)

  return (
    <main className="w-full max-w-screen-xl mx-auto px-6 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href={`/${slug}/cycles`}
            className="hover:text-foreground transition-colors"
          >
            Cycles
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{cycleTitle}</span>
        </nav>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-3xl font-display">
            Mission Control
          </h1>
          <div className="flex items-center gap-3">
            {slackEnabled && (
              <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                Updates posted to Slack
              </span>
            )}
            {onCreatePitch && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border hover:bg-muted transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add pitch
              </button>
            )}
          </div>
        </div>
        {cycleStart && cycleEnd && (
          <CycleWindowStrip
            start={cycleStart}
            end={cycleEnd}
            today={today}
            bands={cycleBands}
          />
        )}
        {showFilter && (
          <SquadFilterBar
            sections={sections}
            active={activeFilter}
            onChange={setActiveFilter}
          />
        )}
      </header>

      {isEmpty ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          No pitches yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map((section) => (
            <SquadSectionBlock
              key={sectionKey(section)}
              section={section}
              slug={slug}
              cycleSlug={cycleSlug}
              today={today}
            />
          ))}
        </div>
      )}

      {onCreatePitch && (
        <CreatePitchDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={onCreatePitch}
        />
      )}

      <footer className="text-xs text-muted-foreground/40 font-mono text-center pb-8">
        mission control · click a pitch to open its scope map
      </footer>
    </main>
  )
}

/**
 * The cycle window — where we are in the cycle as a whole. Reuses the
 * tape-measure visual of a pitch timebox, but it's a distinct concept (ADR
 * 0010): "Timebox" stays reserved for pitches. Week granularity matches the
 * cycle's natural cadence (build = 6 weeks, cooldown = 2).
 */
function CycleWindowStrip({
  start,
  end,
  today,
  bands = [],
}: {
  start: string
  end: string
  today: string
  bands?: OverlayBand[]
}) {
  const info = computeTimebox(start, end, today)
  const weekLabel =
    info.phase === 'before'
      ? 'Not started'
      : info.phase === 'after'
        ? 'Complete'
        : `Week ${info.currentWeek} of ${info.totalWeeks}`

  // Individual (un-clustered) bands: each Holiday / person's Time Off is its own
  // hairline in the fine row, so hovering names exactly who or what.
  const overlayBands = positionBands(bands, { start, end })

  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const status =
    info.phase === 'before' ? 'not started' : info.phase === 'after' ? 'complete' : `${info.daysLeft} days left`

  // The tape renders compact (full-width track) so the overlay hairline row
  // shares its exact horizontal scale — each mark lands on the tape's ticks.
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="uppercase tracking-wide text-muted-foreground">
          Cycle window
        </span>
        <span className="tabular-nums">{weekLabel}</span>
      </div>
      <TimeboxTape start={start} end={end} today={today} compact />
      <CalendarOverlayRow bands={overlayBands} />
      <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{fmt(start)}</span>
        <span className="opacity-70">{status}</span>
        <span>{fmt(end)}</span>
      </div>
    </div>
  )
}

function SquadFilterBar({
  sections,
  active,
  onChange,
}: {
  sections: SquadSection[]
  active: string | null
  onChange: (key: string | null) => void
}) {
  const chip = (
    selected: boolean,
    label: string,
    color: string | undefined,
    onClick: () => void
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors',
        selected
          ? 'bg-foreground text-background border-foreground'
          : 'hover:bg-muted'
      )}
    >
      {color && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by squad">
      {chip(active === null, 'All', undefined, () => onChange(null))}
      {sections.map((section) => {
        const key = sectionKey(section)
        return chip(
          active === key,
          section.squad?.name ?? 'Unassigned',
          section.squad?.color,
          () => onChange(active === key ? null : key)
        )
      })}
    </div>
  )
}

function SquadSectionBlock({
  section,
  slug,
  cycleSlug,
  today,
}: {
  section: SquadSection
  slug: string
  cycleSlug: string
  today: string
}) {
  const { squad, cards } = section
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        {squad ? (
          <>
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: squad.color }}
            />
            <h2 className="text-sm font-semibold tracking-tight">{squad.name}</h2>
          </>
        ) : (
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            Unassigned
          </h2>
        )}
        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full">
          {cards.length}
        </span>
      </div>
      <PitchGrid
        cards={cards}
        slug={slug}
        cycleSlug={cycleSlug}
        today={today}
        squadColor={squad?.color}
      />
    </section>
  )
}

function PitchGrid({
  cards,
  slug,
  cycleSlug,
  today,
  squadColor,
}: {
  cards: PitchCard[]
  slug: string
  cycleSlug: string
  today: string
  squadColor?: string
}) {
  if (cards.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
        No pitches yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <PitchCardItem
          key={card.id}
          card={card}
          slug={slug}
          cycleSlug={cycleSlug}
          today={today}
          delay={i * 0.04}
          squadColor={squadColor}
        />
      ))}
    </div>
  )
}

function PitchCardItem({
  card,
  slug,
  cycleSlug,
  today,
  delay,
  squadColor,
}: {
  card: PitchCard
  slug: string
  cycleSlug: string
  today: string
  delay: number
  squadColor?: string
}) {
  const pitchSlug = slugify(card.title)
  const zoneLabel = card.needle
    ? card.needle.zone.replace('_', ' ')
    : null
  const zoneColor = card.needle ? ZONE_COLORS[card.needle.zone] : undefined

  return (
    <Link
      href={`/${slug}/cycles/${cycleSlug}/${pitchSlug}`}
      className={cn(
        'rounded-lg border border-border/70 bg-card p-5 flex flex-col gap-3',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border hover:bg-muted/30',
        'animate-in fade-in slide-in-from-bottom-1'
      )}
      style={{
        animationDelay: `${delay}s`,
        animationFillMode: 'backwards',
        // Squad identity accent: a colored left edge tying the card to its
        // squad section. Omitted for Unassigned pitches.
        ...(squadColor
          ? { borderLeftColor: squadColor, borderLeftWidth: 3 }
          : {}),
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <MiniNeedle needle={card.needle} delay={delay} />
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            STAGE_BADGE_STYLES[card.stage]
          )}
        >
          {card.stage}
        </span>
      </div>

      {zoneLabel && (
        <span
          className="text-xs font-medium self-start"
          style={{ color: zoneColor }}
        >
          {zoneLabel.charAt(0).toUpperCase() + zoneLabel.slice(1)}
        </span>
      )}

      <h3 className="text-sm font-semibold leading-snug tracking-tight">
        {card.emoji && <span className="mr-1.5">{card.emoji}</span>}
        {card.title}
      </h3>

      <TimeboxTape
        start={card.timebox_start}
        end={card.timebox_end}
        today={today}
        compact
      />

      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>
          {card.scopesTotal} scope{card.scopesTotal === 1 ? '' : 's'}
        </span>
        {card.lastUpdatedAt && (
          <span>{formatRelativeTime(card.lastUpdatedAt)}</span>
        )}
      </div>
    </Link>
  )
}

function CreatePitchDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (title: string) => void
}) {
  const [title, setTitle] = useState('')

  function handleCreate() {
    const trimmed = title.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setTitle('')
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) setTitle('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            New pitch
          </DialogTitle>
        </DialogHeader>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="What are we betting on?"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <DialogFooter className="gap-2">
          <button
            onClick={() => handleOpenChange(false)}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium transition-opacity disabled:opacity-40"
          >
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
