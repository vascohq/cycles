'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { NeedleGauge } from '@/components/needle'
import { HillChart, type HillScope } from '@/components/hill-chart'
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
  scopeGridItems: ScopeGridDerived[]
  parkingLotItems: ParkingLotItem[]
  totalProgress: { done: number; total: number }
  ghost: NeedleSnapshot | null
  today: string
  onStageChange?: (stage: Stage) => void
  onNeedleProgressChange?: (progress: number) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
  onTaskToggle?: (scopeId: string, taskId: string, done: boolean) => void
  onAddTask?: (scopeId: string, title: string) => void
  onAddScope?: (title: string, tier: string) => void
  onEditScope?: (scopeId: string, title: string, tier: string) => void
  onDeleteScope?: (scopeId: string) => void
  onScopeReorder?: (activeId: string, overId: string) => void
  onScopeReset?: (scopeId: string) => void
  onParkingToggle?: (itemId: string, resolved: boolean) => void
  onPostUpdate?: (zone: Zone, narrative: string) => void | Promise<void>
  userName?: string
  timelineCards?: TimelineCard[]
  onRetrySlack?: (updateId: string) => void
}

export function ScopeMapView({
  slug,
  cycleSlug,
  cycleTitle,
  pitch,
  hillScopes,
  scopeGridItems,
  parkingLotItems,
  totalProgress,
  ghost,
  today,
  onStageChange,
  onNeedleProgressChange,
  onHillProgressChange,
  onTaskToggle,
  onAddTask,
  onAddScope,
  onEditScope,
  onDeleteScope,
  onScopeReorder,
  onScopeReset,
  onParkingToggle,
  onPostUpdate,
  userName = 'You',
  timelineCards = [],
  onRetrySlack,
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
    <main className="w-full max-w-screen-xl mx-auto px-6 py-8 flex flex-col gap-10">
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

      <section className="grid grid-cols-1 gap-6 mc-row">
        <div className="flex flex-col items-center gap-3">
          <NeedleGauge
            needle={isDone ? SHIPPED_NEEDLE : pitch.needle}
            ghost={isDone ? null : ghost}
            onProgressChange={isDone ? undefined : onNeedleProgressChange}
            label={isDone ? 'Shipped' : undefined}
          />
          {!isDone && (
            <>
              <button
                onClick={() => setMoveNeedleOpen(true)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border rounded-full px-4 py-1.5"
              >
                Move the needle
              </button>
              {onPostUpdate && (
                <MoveNeedleModal
                  open={moveNeedleOpen}
                  onOpenChange={setMoveNeedleOpen}
                  weekLabel={`Week ${timebox.currentWeek} of ${timebox.totalWeeks}`}
                  dateLabel={new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  userName={userName}
                  pitchTitle={pitch.title}
                  tasksDone={totalProgress.done}
                  tasksTotal={totalProgress.total}
                  daysLeft={timebox.daysLeft}
                  onPost={onPostUpdate}
                />
              )}
            </>
          )}
        </div>

        <div>
          <HillChart
            scopes={hillScopes}
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

      <UpdatesTimeline cards={timelineCards} onRetrySlack={onRetrySlack} />

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

  return (
    <section className="rounded-lg border bg-card p-6 flex flex-col gap-5">
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
