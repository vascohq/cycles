'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Check, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NeedleGauge } from '@/components/needle'
import { useOrganizationUsers } from '@/components/organization-users-context'
import { HillHistory, type HillScope } from '@/components/hill-chart'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import type { HillHistoryFrame } from '@/lib/scope-map-helpers'
import { TimeboxTape } from '@/components/timebox'
import { ScopeGrid } from '@/components/scope-card'
import { ScopeDrawer } from '@/components/scope-card/scope-drawer'
import { ParkingLot, type ParkingLotItem } from '@/components/parking-lot'
import { MoveNeedleModal } from '@/components/move-needle'
import { PitchEmoji } from '@/components/pitch-emoji'
import { NotionLinkPill } from '@/components/notion-link-pill'
import { UpdatesTimeline } from '@/components/updates-timeline'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { TimelineCard } from '@/lib/timeline-helpers'
import type { Stage, Zone, Needle, NeedleSnapshot, PitchView, CardStatus } from '@/cycle-liveblocks.config'
import { KanbanBoard, ViewToggle, CreateCardDialog, type BoardTask } from '@/components/scope-map/kanban-board'
import { TriageTray } from '@/components/scope-map/triage-tray'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { shouldShowCoreScopePrompt } from '@/lib/scope-map-helpers'
import { CoreScopePrompt } from '@/components/scope-map/core-scope-prompt'
import { SHIPPED_NEEDLE } from '@/lib/needle-engine'
import { computeTimebox } from '@/lib/timebox-engine'
import type { Tier } from '@/cycle-liveblocks.config'
import { SquadPicker } from '@/components/scope-map/squad-picker'
import { usePageCelebration } from '@/components/scope-map/use-page-celebration'
import { areAllScopesDone, pageCelebration } from '@/lib/scope-map-helpers'
import { areAllCardsDone } from '@/lib/card-engine'
import type { SquadLike } from '@/lib/squad-engine'
import { usePitchDocumentTitle } from './use-pitch-document-title'
import { STAGES } from '@/lib/stage-engine'
import { StageBadge } from '@/components/scope-map/stage-badge'

export { STAGES }

export type PitchNavItem = {
  title: string
  emoji?: string
  href: string
  current: boolean
}

export type ScopeMapViewProps = {
  slug: string
  cycleSlug: string
  cycleTitle: string
  /** Sibling pitches in this cycle, for the breadcrumb switcher. */
  cyclePitches?: PitchNavItem[]
  pitch: {
    id: string
    title: string
    stage: Stage
    needle: Needle | null
    frame_problem: string
    frame_outcome: string
    timebox_start: string
    timebox_end: string
    emoji: string
    notion_url: string
    squadId?: string
    view?: PitchView
  }
  squads?: SquadLike[]
  currentSquadId?: string
  onAssignSquad?: (name: string) => void
  onClearSquad?: () => void
  squadPitchCounts?: Record<string, number>
  onRenameSquad?: (squadId: string, name: string) => void
  onRecolorSquad?: (squadId: string, color: string) => void
  onDeleteSquad?: (squadId: string) => void
  hillScopes: HillScope[]
  hillTrails?: ScopeTrail[]
  hillHistory?: HillHistoryFrame[]
  scopeGridItems: ScopeGridDerived[]
  parkingLotItems: ParkingLotItem[]
  ghost: NeedleSnapshot | null
  today: string
  onStageChange?: (stage: Stage) => void
  onViewChange?: (view: PitchView) => void
  onTaskStatusChange?: (taskId: string, status: CardStatus) => void
  onTaskScopeChange?: (taskId: string, scopeId: string | null) => void
  /** Unscoped (triage) cards — shown untagged on the Kanban board. */
  unscopedTasks?: BoardTask[]
  onAddCard?: (
    title: string,
    status: CardStatus,
    scopeId: string | null,
    assigneeId: string | null
  ) => void
  onEmojiChange?: (emoji: string) => void
  onNotionUrlChange?: (url: string) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
  onTaskToggle?: (scopeId: string, taskId: string, done: boolean) => void
  onTaskEdit?: (scopeId: string, taskId: string, title: string) => void
  onTaskDelete?: (scopeId: string, taskId: string) => void
  onTaskAssign?: (scopeId: string, taskId: string, assigneeId: string | null) => void
  onTaskReorder?: (activeId: string, overId: string) => void
  onAddTask?: (scopeId: string, title: string) => void
  onAddScope?: (title: string, tier: string, litmus_text: string) => void
  onEditScope?: (
    scopeId: string,
    fields: { title?: string; tier?: Tier; litmus_text?: string; color?: string }
  ) => void
  /** Flag (true) or clear (false) a scope as the pitch's Core Scope. */
  onToggleCoreScope?: (scopeId: string, next: boolean) => void
  onDeleteScope?: (scopeId: string) => void
  onScopeReorder?: (activeId: string, overId: string) => void
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
  cyclePitches,
  pitch,
  squads = [],
  currentSquadId,
  onAssignSquad,
  onClearSquad,
  squadPitchCounts,
  onRenameSquad,
  onRecolorSquad,
  onDeleteSquad,
  hillScopes,
  hillTrails = [],
  hillHistory = [],
  scopeGridItems,
  parkingLotItems,
  ghost,
  today,
  onStageChange,
  onViewChange,
  onTaskStatusChange,
  onTaskScopeChange,
  unscopedTasks = [],
  onAddCard,
  onEmojiChange,
  onNotionUrlChange,
  onHillProgressChange,
  onTaskToggle,
  onTaskEdit,
  onTaskDelete,
  onTaskAssign,
  onTaskReorder,
  onAddTask,
  onAddScope,
  onEditScope,
  onToggleCoreScope,
  onDeleteScope,
  onScopeReorder,
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
  usePitchDocumentTitle(pitch, cycleTitle)
  // Org members for the per-task assignee picker — read from context (no prop
  // drilling), same source the rest of the page uses.
  const orgUsers = useOrganizationUsers()
  const isDone = pitch.stage === 'done'
  // A timebox is optional; guard the tape/labels so an unset one doesn't render
  // as 'Invalid Date' / NaN. The timebox is also the pitch's appetite, so it
  // decides Kanban MODE.
  const hasTimebox = Boolean(pitch.timebox_start && pitch.timebox_end)
  // Kanban MODE (derived — see ADR 0018): a pitch with no timebox/appetite is
  // board-only — no needle, hill, scope map, or view switcher. A pitch WITH a
  // timebox is a Shape-Up pitch that can optionally be *viewed* as a board via
  // the `view` toggle. `showKanban` = render the board, either way.
  const isKanbanMode = !hasTimebox
  const showKanban = isKanbanMode || pitch.view === 'kanban'
  // Page-wide celebration: `color` rain when every scope is done, `gold` rain
  // once the needle hits 100%. Drives both the confetti and the needle-box
  // shimmer that invites the final update during the `color` phase.
  // In Kanban view there's no needle/scopes — the gold parade fires when every
  // card is done (a celebration only, never a stage change; see ADR 0018).
  // Kanban-MODE pitches (no needle) celebrate when every card is done;
  // Shape-Up pitches keep the needle/scope celebration even when viewed as a
  // board (the needle/hill still show — see ADR 0018).
  const celebration = isKanbanMode
    ? areAllCardsDone([
        ...scopeGridItems.flatMap((s) => s.tasks),
        ...unscopedTasks,
      ])
      ? 'gold'
      : 'none'
    : pageCelebration(
        pitch.needle?.progress ?? null,
        areAllScopesDone(scopeGridItems)
      )
  usePageCelebration(celebration)
  const [highlightedScopeId, setHighlightedScopeId] = useState<string | null>(
    null
  )
  const [moveNeedleOpen, setMoveNeedleOpen] = useState(false)
  const [addScopeOpen, setAddScopeOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [openScopeId, setOpenScopeId] = useState<string | null>(null)
  const [deletingScopeId, setDeletingScopeId] = useState<string | null>(null)
  const timebox = computeTimebox(pitch.timebox_start, pitch.timebox_end, today)

  // The drawer reads live from scopeGridItems so edits and task toggles reflect
  // instantly; it closes itself if the open scope is deleted.
  const openScope = openScopeId
    ? scopeGridItems.find((s) => s.id === openScopeId) ?? null
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
        cyclePitches={cyclePitches}
      />

      <HeroCard
        pitch={pitch}
        today={today}
        onStageChange={onStageChange}
        onEmojiChange={onEmojiChange}
        onNotionUrlChange={onNotionUrlChange}
        isDone={isDone}
        squads={squads}
        currentSquadId={currentSquadId}
        onAssignSquad={onAssignSquad}
        onClearSquad={onClearSquad}
        squadPitchCounts={squadPitchCounts}
        onRenameSquad={onRenameSquad}
        onRecolorSquad={onRecolorSquad}
        onDeleteSquad={onDeleteSquad}
      />

      {/* Needle + hill show for any Shape-Up pitch (has a timebox), including
          when it's viewed as a board. A Kanban-MODE pitch (no timebox) has
          neither — see ADR 0018. */}
      {hasTimebox && (
      <section className="grid grid-cols-1 gap-5 mc-row">
        <div>
          {isDone ? (
            <div
              className={`relative rounded-lg border p-4 h-full flex flex-col items-center justify-center gap-3 ${
                celebration === 'gold' ? 'glossy-gold' : 'bg-card'
              }`}
            >
              <div className="relative z-10 flex flex-col items-center gap-3">
                <NeedleGauge needle={SHIPPED_NEEDLE} ghost={null} label="Done" />
              </div>
            </div>
          ) : (
            // The on-page needle is display-only, so the whole card is the click
            // target for moving it — and the pill lights up on hover so it's
            // clear the needle isn't edited in place.
            <button
              type="button"
              onClick={() => setMoveNeedleOpen(true)}
              aria-label="Move the needle"
              data-shimmer={celebration === 'color' ? 'true' : undefined}
              className={`group relative w-full h-full rounded-lg border p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                celebration === 'gold'
                  ? 'glossy-gold'
                  : celebration === 'color'
                    ? 'bg-card hover:bg-muted/30 shimmer-border'
                    : 'bg-card hover:bg-muted/30'
              }`}
            >
              <div className="relative z-10 flex flex-col items-center gap-3">
                <NeedleGauge needle={pitch.needle} ghost={ghost} />
                <span className="text-xs font-medium border rounded-full px-4 py-1.5 transition-colors text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 group-hover:bg-muted">
                  Move the needle
                </span>
              </div>
            </button>
          )}
          {!isDone && onPostUpdate && (
            <MoveNeedleModal
              open={moveNeedleOpen}
              onOpenChange={setMoveNeedleOpen}
              weekLabel={hasTimebox ? `Week ${timebox.currentWeek} of ${timebox.totalWeeks}` : ''}
              dateLabel={new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              userName={userName}
              pitchTitle={pitch.title}
              pitchEmoji={pitch.emoji}
              daysLeft={hasTimebox ? timebox.daysLeft : 0}
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
      )}

      {showKanban && (
        <section>
          <KanbanBoard
            scopes={scopeGridItems}
            unscopedTasks={unscopedTasks}
            orgUsers={orgUsers}
            view={pitch.view ?? 'kanban'}
            onViewChange={hasTimebox ? onViewChange : undefined}
            onCardStatusChange={isDone ? undefined : onTaskStatusChange}
            onCardEdit={
              !isDone && onTaskEdit ? (id, title) => onTaskEdit('', id, title) : undefined
            }
            onCardAssign={
              !isDone && onTaskAssign ? (id, uid) => onTaskAssign('', id, uid) : undefined
            }
            onCardDelete={
              !isDone && onTaskDelete ? (id) => onTaskDelete('', id) : undefined
            }
            onCardScope={isDone ? undefined : onTaskScopeChange}
            onAddCard={isDone ? undefined : onAddCard}
          />
        </section>
      )}

      {!showKanban && (
      <section>
        {onToggleCoreScope &&
          shouldShowCoreScopePrompt(scopeGridItems) && (
            <div className="mb-4">
              <CoreScopePrompt
                scopes={scopeGridItems.map((s) => ({
                  id: s.id,
                  title: s.title,
                }))}
                onChoose={(scopeId) => onToggleCoreScope(scopeId, true)}
              />
            </div>
          )}
        <div className="flex items-center gap-3 mb-4">
          {onViewChange ? (
            <ViewToggle view="scope_map" onChange={onViewChange} />
          ) : (
            <h2 className="text-sm font-semibold tracking-tight">Scopes</h2>
          )}
          {!isDone && (
            <span className="text-xs text-muted-foreground/50 font-mono">
              drag to reorder
            </span>
          )}
          {!isDone && (onAddCard || onAddScope) && (
            <div className="ml-auto flex items-center gap-2">
              {onAddScope && (
                <button
                  type="button"
                  onClick={() => setAddScopeOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add scope
                </button>
              )}
              {onAddCard && (
                <button
                  type="button"
                  onClick={() => setAddTaskOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add task
                </button>
              )}
            </div>
          )}
        </div>
        {/* Unscoped (triage) cards — under the filter/switcher row, above the
            scope grid; self-hides when empty (see ADR 0018). */}
        {onTaskScopeChange && (
          <div className="mb-4">
            <TriageTray
              tasks={unscopedTasks.map((t) => ({ id: t.id, title: t.title }))}
              scopes={scopeGridItems.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
              onAssignScope={onTaskScopeChange}
            />
          </div>
        )}
        <ScopeGrid
          scopes={scopeGridItems}
          orgUsers={orgUsers}
          onReorder={isDone ? undefined : onScopeReorder}
          onOpenScope={(id) => setOpenScopeId(id)}
          onDeleteScope={!isDone && onDeleteScope ? (id) => setDeletingScopeId(id) : undefined}
          onToggleCoreScope={!isDone ? onToggleCoreScope : undefined}
          readOnly={isDone}
        />
        <ScopeDrawer
          open={!!openScope}
          onOpenChange={(open) => { if (!open) setOpenScopeId(null) }}
          scope={openScope}
          usedColors={scopeGridItems
            .filter((s) => s.id !== openScopeId)
            .map((s) => s.color)}
          readOnly={isDone}
          onEditScope={
            !isDone && onEditScope && openScopeId
              ? (fields) => onEditScope(openScopeId, fields)
              : undefined
          }
          onToggleCore={
            !isDone && onToggleCoreScope && openScopeId
              ? (next) => onToggleCoreScope(openScopeId, next)
              : undefined
          }
          onTaskToggle={
            !isDone && onTaskToggle && openScopeId
              ? (taskId, done) => onTaskToggle(openScopeId, taskId, done)
              : undefined
          }
          onTaskEdit={
            !isDone && onTaskEdit && openScopeId
              ? (taskId, title) => onTaskEdit(openScopeId, taskId, title)
              : undefined
          }
          onTaskDelete={
            !isDone && onTaskDelete && openScopeId
              ? (taskId) => onTaskDelete(openScopeId, taskId)
              : undefined
          }
          onTaskAssign={
            !isDone && onTaskAssign && openScopeId
              ? (taskId, assigneeId) => onTaskAssign(openScopeId, taskId, assigneeId)
              : undefined
          }
          onTaskReorder={!isDone ? onTaskReorder : undefined}
          orgUsers={orgUsers}
          onAddTask={
            !isDone && onAddTask && openScopeId
              ? (title) => onAddTask(openScopeId, title)
              : undefined
          }
        />
        {onAddScope && (
          <ScopeDialog
            open={addScopeOpen}
            onOpenChange={setAddScopeOpen}
            title="New scope"
            submitLabel="Add scope"
            onSubmit={(t, tier, litmus) => { onAddScope(t, tier, litmus); setAddScopeOpen(false) }}
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
      )}

      {onAddCard && addTaskOpen && (
        <CreateCardDialog
          defaultStatus="todo"
          orgUsers={orgUsers}
          scopeOptions={scopeGridItems.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
          onCreate={onAddCard}
          onClose={() => setAddTaskOpen(false)}
        />
      )}

      <section>
        <ParkingLot
          items={parkingLotItems}
          onToggleResolved={isDone ? undefined : onParkingToggle}
          readOnly={isDone}
        />
      </section>

      {/* Updates belong to Shape-Up pitches (they have a needle/timebox). A
          Kanban-mode pitch (no timebox) is board-only — no updates. */}
      {hasTimebox && (
        <UpdatesTimeline
          cards={timelineCards}
          onRetrySlack={onRetrySlack}
          onDeleteUpdate={isDone ? undefined : onDeleteUpdate}
        />
      )}
    </main>
  )
}

function AppBar({
  slug,
  cycleSlug,
  cycleTitle,
  pitchTitle,
  cyclePitches,
}: {
  slug: string
  cycleSlug: string
  cycleTitle: string
  pitchTitle: string
  cyclePitches?: PitchNavItem[]
}) {
  // Other pitches in the cycle, for the switcher dropdown (current one excluded
  // — it's already the label).
  const others = (cyclePitches ?? []).filter((p) => !p.current)

  return (
    <nav className="flex items-center">
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
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 text-foreground font-medium outline-none hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-ring rounded">
              {pitchTitle}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {(cyclePitches ?? []).map((p) => (
                <DropdownMenuItem key={p.href} asChild>
                  <Link
                    href={p.href}
                    className={`flex items-center gap-2 ${p.current ? 'font-medium' : ''}`}
                  >
                    {p.emoji && <span className="text-sm">{p.emoji}</span>}
                    <span className="flex-1 truncate">{p.title}</span>
                    {p.current && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-foreground font-medium">{pitchTitle}</span>
        )}
      </div>
    </nav>
  )
}

function HeroCard({
  pitch,
  today,
  onStageChange,
  onEmojiChange,
  onNotionUrlChange,
  isDone,
  squads = [],
  currentSquadId,
  onAssignSquad,
  onClearSquad,
  squadPitchCounts,
  onRenameSquad,
  onRecolorSquad,
  onDeleteSquad,
}: {
  pitch: {
    title: string
    stage: Stage
    frame_problem: string
    frame_outcome: string
    timebox_start: string
    timebox_end: string
    emoji: string
    notion_url: string
  }
  today: string
  onStageChange?: (stage: Stage) => void
  onEmojiChange?: (emoji: string) => void
  onNotionUrlChange?: (url: string) => void
  isDone?: boolean
  squads?: SquadLike[]
  currentSquadId?: string
  onAssignSquad?: (name: string) => void
  onClearSquad?: () => void
  squadPitchCounts?: Record<string, number>
  onRenameSquad?: (squadId: string, name: string) => void
  onRecolorSquad?: (squadId: string, color: string) => void
  onDeleteSquad?: (squadId: string) => void
}) {
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
      className={`group/hero relative rounded-lg border bg-card overflow-hidden ${
        animate ? 'transition-[max-height] duration-500 ease-in-out' : ''
      }`}
      style={{ maxHeight: collapsed ? COLLAPSED_PX : 2000 }}
    >
      <div ref={contentRef} className={`p-6 flex flex-col gap-5 ${overflowing ? 'pb-12' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <PitchEmoji
              emoji={pitch.emoji}
              onChange={onEmojiChange}
              className="text-2xl md:text-3xl mt-0.5 shrink-0"
            />
            <div className="flex flex-col gap-2 min-w-0">
              <h1 className="text-2xl md:text-3xl font-display leading-tight">
                {pitch.title}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                {onStageChange && (
                  <StageBadge stage={pitch.stage} onChange={onStageChange} />
                )}
                {onAssignSquad && (
                  <SquadPicker
                    squads={squads}
                    currentSquadId={currentSquadId}
                    onAssign={onAssignSquad}
                    onClear={onClearSquad ?? (() => {})}
                    pitchCounts={squadPitchCounts}
                    onRenameSquad={onRenameSquad}
                    onRecolorSquad={onRecolorSquad}
                    onDeleteSquad={onDeleteSquad}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotionLinkPill url={pitch.notion_url} onChange={onNotionUrlChange} />
          </div>
        </div>

        {pitch.timebox_start && pitch.timebox_end && (
          <TimeboxTape
            start={pitch.timebox_start}
            end={pitch.timebox_end}
            today={today}
            done={isDone}
          />
        )}

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
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border bg-background rounded-full px-3 py-1 opacity-0 group-hover/hero:opacity-100 focus-visible:opacity-100 transition-opacity"
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


const TIERS: Tier[] = ['must', 'should', 'could']

function ScopeDialog({
  open,
  onOpenChange,
  title: dialogTitle,
  submitLabel,
  initialTitle = '',
  initialTier = 'must',
  initialLitmus = '',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialTitle?: string
  initialTier?: Tier
  initialLitmus?: string
  onSubmit: (title: string, tier: string, litmus_text: string) => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [tier, setTier] = useState<Tier>(initialTier)
  const [litmus, setLitmus] = useState(initialLitmus)

  // Sync initial values when the dialog opens with new scope data
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setTitle(initialTitle)
    setTier(initialTier)
    setLitmus(initialLitmus)
  }
  if (open !== prevOpen) setPrevOpen(open)

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed, tier, litmus.trim())
  }

  function handleOpenChange(next: boolean) {
    if (!next) { setTitle(initialTitle); setTier(initialTier); setLitmus(initialLitmus) }
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
          <textarea
            value={litmus}
            onChange={(e) => setLitmus(e.target.value)}
            placeholder="What it ships (optional) — if only this ships, what does it deliver?"
            rows={2}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
          />
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
