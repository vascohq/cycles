'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { NeedleGauge } from '@/components/needle'
import { HillHistory, type HillScope } from '@/components/hill-chart'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import type { HillHistoryFrame } from '@/lib/scope-map-helpers'
import { TimeboxTape } from '@/components/timebox'
import { ScopeGrid } from '@/components/scope-card'
import { ParkingLot, type ParkingLotItem } from '@/components/parking-lot'
import { MoveNeedleModal } from '@/components/move-needle'
import { UpdatesTimeline } from '@/components/updates-timeline'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { TimelineCard } from '@/lib/timeline-helpers'
import type { Stage, Zone, Needle, NeedleSnapshot } from '@/cycle-liveblocks.config'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { SHIPPED_NEEDLE } from '@/lib/needle-engine'
import { computeTimebox } from '@/lib/timebox-engine'
import type { Tier } from '@/cycle-liveblocks.config'

export const STAGES: Stage[] = ['framing', 'shaping', 'building', 'done']

export type ScopeMapViewProps = {
  slug: string
  cycleSlug: string
  cycleTitle: string
  pitch: {
    id: string
    title: string
    stage: Stage
    needle: Needle | null
    frame_problem: string
    frame_outcome: string
    timebox_start: string
    timebox_end: string
  }
  hillScopes: HillScope[]
  hillTrails?: ScopeTrail[]
  hillHistory?: HillHistoryFrame[]
  scopeGridItems: ScopeGridDerived[]
  parkingLotItems: ParkingLotItem[]
  totalProgress: { done: number; total: number }
  ghost: NeedleSnapshot | null
  today: string
  onStageChange?: (stage: Stage) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
  onTaskToggle?: (scopeId: string, taskId: string, done: boolean) => void
  onTaskEdit?: (scopeId: string, taskId: string, title: string) => void
  onTaskDelete?: (scopeId: string, taskId: string) => void
  onAddTask?: (scopeId: string, title: string) => void
  onAddScope?: (title: string, tier: string) => void
  onEditScope?: (scopeId: string, title: string, tier: string) => void
  onDeleteScope?: (scopeId: string) => void
  onScopeReorder?: (activeId: string, overId: string) => void
  onScopeReset?: (scopeId: string) => void
  onParkingToggle?: (itemId: string, resolved: boolean) => void
  onPostUpdate?: (progress: number, zone: Zone, narrative: string) => void | Promise<void>
  userName?: string
  /** Zone at the last update — drives the preview's zone-transition line. */
  previousZone?: Zone | null
  /** Needle position at the last update — drives the progress celebration. */
  previousNeedleProgress?: number | null
  /** Scope positions at the last update — the "before" hill in the modal. */
  previousHillScopes?: HillScope[]
  /** Pre-computed hill-movement summary for the Slack preview. */
  movementPreview?: string | null
  timelineCards?: TimelineCard[]
  onRetrySlack?: (updateId: string) => void
  onDeleteUpdate?: (updateId: string) => void
}

export function ScopeMapView({
  slug,
  cycleSlug,
  cycleTitle,
  pitch,
  hillScopes,
  hillTrails = [],
  hillHistory = [],
  scopeGridItems,
  parkingLotItems,
  totalProgress,
  ghost,
  today,
  onStageChange,
  onHillProgressChange,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onAddScope,
  onEditScope,
  onDeleteScope,
  onScopeReorder,
  onScopeReset,
  onParkingToggle,
  onPostUpdate,
  userName = 'You',
  previousZone = null,
  previousNeedleProgress = null,
  previousHillScopes = [],
  movementPreview = null,
  timelineCards = [],
  onRetrySlack,
  onDeleteUpdate,
}: ScopeMapViewProps) {
  const isDone = pitch.stage === 'done'
  const [highlightedScopeId, setHighlightedScopeId] = useState<string | null>(
    null
  )
  const [moveNeedleOpen, setMoveNeedleOpen] = useState(false)
  const [addScopeOpen, setAddScopeOpen] = useState(false)
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null)
  const [deletingScopeId, setDeletingScopeId] = useState<string | null>(null)
  const timebox = computeTimebox(pitch.timebox_start, pitch.timebox_end, today)

  const editingScope = editingScopeId
    ? scopeGridItems.find((s) => s.id === editingScopeId) ?? null
    : null

  const deletingScope = deletingScopeId
    ? scopeGridItems.find((s) => s.id === deletingScopeId) ?? null
    : null

  return (
    <main className="w-full max-w-screen-xl mx-auto px-6 py-6 flex flex-col gap-5">
      <AppBar
        slug={slug}
        cycleSlug={cycleSlug}
        cycleTitle={cycleTitle}
        pitchTitle={pitch.title}
        totalProgress={totalProgress}
      />

      <HeroCard
        pitch={pitch}
        today={today}
        onStageChange={onStageChange}
        isDone={isDone}
      />

      <section className="grid grid-cols-1 gap-5 mc-row">
        <div>
          {isDone ? (
            <div className="rounded-lg border bg-card p-4 h-full flex flex-col items-center justify-center gap-3">
              <NeedleGauge needle={SHIPPED_NEEDLE} ghost={null} label="Shipped" />
            </div>
          ) : (
            // The on-page needle is display-only, so the whole card is the click
            // target for moving it — and the pill lights up on hover so it's
            // clear the needle isn't edited in place.
            <button
              type="button"
              onClick={() => setMoveNeedleOpen(true)}
              aria-label="Move the needle"
              className="group w-full h-full rounded-lg border bg-card p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors hover:border-foreground/20 hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <NeedleGauge needle={pitch.needle} ghost={ghost} />
              <span className="text-xs font-medium border rounded-full px-4 py-1.5 transition-colors text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 group-hover:bg-muted">
                Move the needle
              </span>
            </button>
          )}
          {!isDone && onPostUpdate && (
            <MoveNeedleModal
              open={moveNeedleOpen}
              onOpenChange={setMoveNeedleOpen}
              weekLabel={`Week ${timebox.currentWeek} of ${timebox.totalWeeks}`}
              dateLabel={new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              userName={userName}
              pitchTitle={pitch.title}
              daysLeft={timebox.daysLeft}
              currentProgress={pitch.needle?.progress ?? 0.02}
              currentZone={pitch.needle?.zone ?? null}
              previousZone={previousZone}
              previousNeedleProgress={previousNeedleProgress}
              previousHillScopes={previousHillScopes}
              ghost={ghost}
              movementPreview={movementPreview}
              hillScopes={hillScopes}
              hillTrails={hillTrails}
              onPost={onPostUpdate}
            />
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <HillHistory
            scopes={hillScopes}
            trails={hillTrails}
            history={hillHistory}
            highlightedScopeId={highlightedScopeId}
            onScopeHover={setHighlightedScopeId}
            onHillProgressChange={isDone ? undefined : onHillProgressChange}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Scopes</h2>
          {!isDone && (
            <span className="text-xs text-muted-foreground/50 font-mono">
              drag to reorder
            </span>
          )}
          {!isDone && onAddScope && (
            <button
              type="button"
              onClick={() => setAddScopeOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-auto"
            >
              <Plus className="w-3 h-3" />
              add scope
            </button>
          )}
        </div>
        <ScopeGrid
          scopes={scopeGridItems}
          onReorder={isDone ? undefined : onScopeReorder}
          onTaskToggle={isDone ? undefined : onTaskToggle}
          onTaskEdit={isDone ? undefined : onTaskEdit}
          onTaskDelete={isDone ? undefined : onTaskDelete}
          onAddTask={isDone ? undefined : onAddTask}
          onReset={isDone ? undefined : onScopeReset}
          onEditScope={!isDone && onEditScope ? (id) => setEditingScopeId(id) : undefined}
          onDeleteScope={!isDone && onDeleteScope ? (id) => setDeletingScopeId(id) : undefined}
          readOnly={isDone}
        />
        {onAddScope && (
          <ScopeDialog
            open={addScopeOpen}
            onOpenChange={setAddScopeOpen}
            title="New scope"
            submitLabel="Add scope"
            onSubmit={(t, tier) => { onAddScope(t, tier); setAddScopeOpen(false) }}
          />
        )}
        {onEditScope && editingScope && (
          <ScopeDialog
            open={!!editingScopeId}
            onOpenChange={(open) => { if (!open) setEditingScopeId(null) }}
            title="Edit scope"
            submitLabel="Save"
            initialTitle={editingScope.title}
            initialTier={editingScope.tier}
            onSubmit={(t, tier) => { onEditScope(editingScopeId!, t, tier); setEditingScopeId(null) }}
          />
        )}
        {onDeleteScope && deletingScope && (
          <DeleteScopeDialog
            open={!!deletingScopeId}
            onOpenChange={(open) => { if (!open) setDeletingScopeId(null) }}
            scopeTitle={deletingScope.title}
            taskCount={deletingScope.tasks.length}
            onConfirm={() => { onDeleteScope(deletingScopeId!); setDeletingScopeId(null) }}
          />
        )}
      </section>

      <section>
        <ParkingLot
          items={parkingLotItems}
          onToggleResolved={isDone ? undefined : onParkingToggle}
          readOnly={isDone}
        />
      </section>

      <UpdatesTimeline
        cards={timelineCards}
        onRetrySlack={onRetrySlack}
        onDeleteUpdate={isDone ? undefined : onDeleteUpdate}
      />

      <footer className="text-xs text-muted-foreground/40 font-mono text-center pb-8">
        scope map · drag dots on the hill · check tasks · move the needle
      </footer>
    </main>
  )
}

function AppBar({
  slug,
  cycleSlug,
  cycleTitle,
  pitchTitle,
  totalProgress,
}: {
  slug: string
  cycleSlug: string
  cycleTitle: string
  pitchTitle: string
  totalProgress: { done: number; total: number }
}) {
  return (
    <nav className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href={`/${slug}/cycles`}
          className="hover:text-foreground transition-colors"
        >
          Cycles
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link
          href={`/${slug}/cycles/${cycleSlug}`}
          className="hover:text-foreground transition-colors"
        >
          {cycleTitle}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{pitchTitle}</span>
      </div>
      <div className="text-xs font-mono text-muted-foreground">
        {totalProgress.done} / {totalProgress.total} tasks
      </div>
    </nav>
  )
}

function HeroCard({
  pitch,
  today,
  onStageChange,
  isDone,
}: {
  pitch: {
    title: string
    stage: Stage
    frame_problem: string
    frame_outcome: string
    timebox_start: string
    timebox_end: string
  }
  today: string
  onStageChange?: (stage: Stage) => void
  isDone?: boolean
}) {
  const stageIndex = STAGES.indexOf(pitch.stage)

  // Keep the header to a fixed height; if the framing overflows, fade it out
  // and let "View more" slide the rest into view.
  const COLLAPSED_PX = 250
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  // Default to "overflowing" so the first paint is already collapsed (no flash
  // of full content), then correct after measuring.
  const [overflowing, setOverflowing] = useState(true)
  // Transitions are enabled a frame after mount so the initial collapse doesn't
  // animate (no slide-up on load) — only user toggles animate.
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => setOverflowing(el.scrollHeight > COLLAPSED_PX + 8)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const raf = requestAnimationFrame(() => setAnimate(true))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [pitch.title, pitch.frame_problem, pitch.frame_outcome])

  const collapsed = overflowing && !expanded

  return (
    <section
      className={`group relative rounded-lg border bg-card overflow-hidden ${
        animate ? 'transition-[max-height] duration-500 ease-in-out' : ''
      }`}
      style={{ maxHeight: collapsed ? COLLAPSED_PX : 2000 }}
    >
      <div ref={contentRef} className={`p-6 flex flex-col gap-5 ${overflowing ? 'pb-12' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-display leading-tight">
            {pitch.title}
          </h1>
          {onStageChange && (
            <StageButtons stage={pitch.stage} onStageChange={onStageChange} />
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          {STAGES.map((s, i) => (
            <span key={s} className={i <= stageIndex ? 'text-foreground' : ''}>
              {s} {i < stageIndex ? '✓' : i === stageIndex ? '←' : ''}
            </span>
          ))}
        </div>

        <TimeboxTape
          start={pitch.timebox_start}
          end={pitch.timebox_end}
          today={today}
          done={isDone}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Problem
            </h3>
            <FramingList text={pitch.frame_problem} />
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Outcome
            </h3>
            <FramingList text={pitch.frame_outcome} />
          </div>
        </div>
      </div>

      {/* Fade + toggle when the framing exceeds the fixed height */}
      {collapsed && (
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border bg-background rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          {expanded ? 'View less' : 'View more'}
        </button>
      )}
    </section>
  )
}

// Problem & outcome are always shown as bullets. Each non-empty line becomes a
// list item; any existing leading marker ("1.", "-", "•", "*") is stripped so
// the list renders consistently regardless of how the text was authored.
function FramingList({ text }: { text: string }) {
  const items = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Not yet defined</p>
  }

  return (
    <ul className="text-sm flex flex-col gap-1.5 list-disc pl-4 marker:text-muted-foreground/40">
      {items.map((item, i) => (
        <li key={i} className="leading-snug">
          {item}
        </li>
      ))}
    </ul>
  )
}

function StageButtons({
  stage,
  onStageChange,
}: {
  stage: Stage
  onStageChange: (stage: Stage) => void
}) {
  const currentIndex = STAGES.indexOf(stage)

  return (
    <div className="flex gap-1">
      {currentIndex > 0 && (
        <button
          onClick={() => onStageChange(STAGES[currentIndex - 1])}
          className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
        >
          ← {STAGES[currentIndex - 1]}
        </button>
      )}
      {currentIndex < STAGES.length - 1 && (
        <button
          onClick={() => onStageChange(STAGES[currentIndex + 1])}
          className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
        >
          {STAGES[currentIndex + 1]} →
        </button>
      )}
    </div>
  )
}

const TIERS: Tier[] = ['must', 'should', 'could']

function ScopeDialog({
  open,
  onOpenChange,
  title: dialogTitle,
  submitLabel,
  initialTitle = '',
  initialTier = 'must',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialTitle?: string
  initialTier?: Tier
  onSubmit: (title: string, tier: string) => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [tier, setTier] = useState<Tier>(initialTier)

  // Sync initial values when the dialog opens with new scope data
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setTitle(initialTitle)
    setTier(initialTier)
  }
  if (open !== prevOpen) setPrevOpen(open)

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed, tier)
  }

  function handleOpenChange(next: boolean) {
    if (!next) { setTitle(initialTitle); setTier(initialTier) }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Scope name…"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="text-sm bg-background border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
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
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium transition-opacity disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteScopeDialog({
  open,
  onOpenChange,
  scopeTitle,
  taskCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopeTitle: string
  taskCount: number
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            Delete scope
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete <strong>{scopeTitle}</strong>
          {taskCount > 0 && ` and its ${taskCount} task${taskCount === 1 ? '' : 's'}`}?
          This can&apos;t be undone.
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
