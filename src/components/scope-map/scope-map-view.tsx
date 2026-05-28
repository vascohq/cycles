'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { NeedleGauge } from '@/components/needle'
import { HillChart, type HillScope } from '@/components/hill-chart'
import { TimeboxTape } from '@/components/timebox'
import { ScopeGrid } from '@/components/scope-card'
import { ParkingLot, type ParkingLotItem } from '@/components/parking-lot'
import { MoveNeedleModal } from '@/components/move-needle'
import { UpdatesTimeline } from '@/components/updates-timeline'
import type { TimelineCard } from '@/lib/timeline-helpers'
import type { Stage, Zone, Needle, NeedleSnapshot } from '@/cycle-liveblocks.config'
import type { ScopeGridDerived } from '@/lib/scope-map-helpers'
import { SHIPPED_NEEDLE } from '@/lib/needle-engine'
import { isTuesday, weekOfTimebox } from '@/lib/update-engine'
import { cn } from '@/lib/utils'

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
  onScopeReorder?: (activeId: string, overId: string) => void
  onScopeReset?: (scopeId: string) => void
  onParkingToggle?: (itemId: string, resolved: boolean) => void
  onPostUpdate?: (zone: Zone, narrative: string) => void | Promise<void>
  userName?: string
  channelName?: string
  timelineCards?: TimelineCard[]
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
  onScopeReorder,
  onScopeReset,
  onParkingToggle,
  onPostUpdate,
  userName = 'You',
  channelName = 'general',
  timelineCards = [],
}: ScopeMapViewProps) {
  const isDone = pitch.stage === 'done'
  const [highlightedScopeId, setHighlightedScopeId] = useState<string | null>(
    null
  )
  const [moveNeedleOpen, setMoveNeedleOpen] = useState(false)
  const tuesday = !isDone && isTuesday(today)
  const totalDays = Math.round(
    (new Date(pitch.timebox_end + 'T00:00:00').getTime() -
      new Date(pitch.timebox_start + 'T00:00:00').getTime()) /
      86_400_000
  )
  const totalWeeks = Math.ceil(totalDays / 7)
  const currentWeek = weekOfTimebox(pitch.timebox_start, pitch.timebox_end, today)

  return (
    <main className="w-full max-w-screen-lg mx-auto px-6 py-8 flex flex-col gap-10">
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
                className={cn(
                  'text-xs font-gloria text-muted-foreground hover:text-foreground transition-colors border rounded-full px-4 py-1.5',
                  tuesday && 'animate-pulse'
                )}
              >
                Move the needle
              </button>
              {onPostUpdate && (
                <MoveNeedleModal
                  open={moveNeedleOpen}
                  onOpenChange={setMoveNeedleOpen}
                  weekLabel={`Week ${currentWeek} of ${totalWeeks}`}
                  dateLabel={new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  userName={userName}
                  channelName={channelName}
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
          <h2 className="font-gloria text-lg">Scopes</h2>
          {!isDone && (
            <span className="text-xs text-muted-foreground/50 font-mono">
              drag to reorder
            </span>
          )}
        </div>
        <ScopeGrid
          scopes={scopeGridItems}
          onReorder={isDone ? undefined : onScopeReorder}
          onTaskToggle={isDone ? undefined : onTaskToggle}
          onReset={isDone ? undefined : onScopeReset}
          readOnly={isDone}
        />
      </section>

      <section>
        <ParkingLot
          items={parkingLotItems}
          onToggleResolved={isDone ? undefined : onParkingToggle}
          readOnly={isDone}
        />
      </section>

      <UpdatesTimeline cards={timelineCards} channelName={channelName} />

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
        <span className="text-foreground font-semibold">{pitchTitle}</span>
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
    <section className="rounded-xl border bg-card p-6 flex flex-col gap-5 hover:shadow-[4px_4px_0_0_hsl(var(--foreground))] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-gloria text-3xl md:text-[44px] leading-tight">
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
          <h3 className="font-gloria text-xs text-muted-foreground mb-2">
            Problem
          </h3>
          <p className="text-sm">
            {pitch.frame_problem || 'Not yet defined'}
          </p>
        </div>
        <div>
          <h3 className="font-gloria text-xs text-muted-foreground mb-2">
            Outcome
          </h3>
          <p className="text-sm">
            {pitch.frame_outcome || 'Not yet defined'}
          </p>
        </div>
      </div>
    </section>
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
