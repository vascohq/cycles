'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TimeboxTape, CalendarOverlayRow } from '@/components/timebox'
import { computeTimebox } from '@/lib/timebox-engine'
import { positionBands, observeHolidays } from '@/lib/calendar/overlay-positioning'
import type { OverlayBand } from '@/lib/calendar/ics-normalizer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { SquadSection } from '@/lib/mission-control-helpers'
import { sectionKey, filterSquadSections } from '@/lib/mission-control-helpers'
import { cn } from '@/lib/utils'
import { PitchTimeline, TIMELINE_GRID } from './pitch-timeline'

export type MissionControlViewProps = {
  slug: string
  cycleSlug: string
  cycleTitle: string
  /** A cooldown cycle gets an ice-cube marker on the head. */
  cycleType?: 'build' | 'cooldown'
  today: string
  sections: SquadSection[]
  onCreatePitch?: (title: string) => void
  /** The cycle window's boundaries (see ADR 0010). Omitted = not yet set. */
  cycleStart?: string
  cycleEnd?: string
  /** Calendar overlay bands (Holidays / Time Off) for the cycle window. */
  cycleBands?: OverlayBand[]
  /** Optional controls rendered in the header (e.g. Edit cycle). */
  headerActions?: React.ReactNode
  /** Controls rendered on the breadcrumb row (e.g. the cycle stepper). */
  cycleNav?: React.ReactNode
  /** Optional banner rendered above the header (e.g. the archived notice). */
  banner?: React.ReactNode
}

export function MissionControlView({
  slug,
  cycleSlug,
  cycleTitle,
  cycleType,
  today,
  sections,
  onCreatePitch,
  cycleStart,
  cycleEnd,
  cycleBands,
  headerActions,
  cycleNav,
  banner,
}: MissionControlViewProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const isEmpty = sections.length === 0
  // Show the filter only when there's more than one section to choose between.
  const showFilter = sections.length > 1
  const visibleSections = filterSquadSections(sections, activeFilter)

  return (
    <main className="w-full max-w-screen-xl mx-auto px-6 pt-5 pb-8 flex flex-col gap-8">
      {banner}
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-2 truncate text-3xl font-display">
            {cycleType === 'cooldown' && <span aria-hidden>🧊</span>}
            {cycleTitle}
          </h1>
          <div className="flex items-center gap-3">
            {cycleNav}
            {headerActions}
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
      </header>

      {(showFilter || onCreatePitch) && (
        <div className="-my-4 flex flex-wrap items-center gap-3">
          {showFilter && (
            <SquadFilterBar
              sections={sections}
              active={activeFilter}
              onChange={setActiveFilter}
            />
          )}
          {onCreatePitch && (
            <button
              onClick={() => setCreateOpen(true)}
              className="ml-auto flex items-center gap-1 text-xs px-3 py-1 rounded-lg border hover:bg-muted transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add pitch
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          No pitches yet.
        </div>
      ) : (
        <PitchTimeline
          sections={visibleSections}
          slug={slug}
          cycleSlug={cycleSlug}
          today={today}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
        />
      )}

      {onCreatePitch && (
        <CreatePitchDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={onCreatePitch}
        />
      )}
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
  // hairline in the fine row, so hovering names exactly who or what. Weekend
  // holidays are first shifted to their observed (in-lieu) business day.
  const overlayBands = positionBands(observeHolidays(bands), { start, end })

  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const status =
    info.phase === 'before' ? 'not started' : info.phase === 'after' ? 'complete' : `${info.daysLeft} days left`

  // Aligned [gutter | track] grid (shared TIMELINE_GRID) so the tape track and
  // the pitch-timeline bars below share one scale — the "now" markers line up.
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className={TIMELINE_GRID}>
        <div className="text-xs font-medium">
          <div className="uppercase tracking-wide text-muted-foreground">Cycle window</div>
          <div className="tabular-nums text-muted-foreground">{weekLabel}</div>
        </div>
        <div className="flex flex-col gap-1">
          <CalendarOverlayRow bands={overlayBands} anchor="bottom" />
          <TimeboxTape start={start} end={end} today={today} compact />
          <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{fmt(start)}</span>
            <span className="opacity-70">{status}</span>
            <span>{fmt(end)}</span>
          </div>
        </div>
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
