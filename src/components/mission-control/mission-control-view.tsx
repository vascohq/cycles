'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MiniNeedle } from '@/components/needle/mini-needle'
import { TimeboxTape } from '@/components/timebox'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { PitchCard } from '@/lib/mission-control-helpers'
import type { Stage } from '@/cycle-liveblocks.config'
import { useSlackEnabled } from '@/components/slack-config-context'
import { cn } from '@/lib/utils'

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
  inFlight: PitchCard[]
  done: PitchCard[]
  onCreatePitch?: (title: string) => void
}

export function MissionControlView({
  slug,
  cycleSlug,
  today,
  inFlight,
  done,
  onCreatePitch,
}: MissionControlViewProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const slackEnabled = useSlackEnabled()

  return (
    <main className="w-full max-w-screen-lg mx-auto px-6 py-8 flex flex-col gap-10">
      <header className="text-center flex flex-col gap-2">
        <h1 className="font-gloria text-4xl md:text-[56px] leading-tight">
          Mission Control
        </h1>
        {slackEnabled && (
          <p className="text-sm font-mono text-muted-foreground">
            Updates posted to Slack
          </p>
        )}
      </header>

      <Section
        title="In flight"
        count={inFlight.length}
        subtitle={slackEnabled ? 'Updates posted to Slack' : undefined}
        action={
          onCreatePitch && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border hover:bg-muted transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add pitch
            </button>
          )
        }
      >
        <PitchGrid
          cards={inFlight}
          slug={slug}
          cycleSlug={cycleSlug}
          today={today}
        />
      </Section>

      {done.length > 0 && (
        <Section title="Done" count={done.length}>
          <PitchGrid
            cards={done}
            slug={slug}
            cycleSlug={cycleSlug}
            today={today}
          />
        </Section>
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

function Section({
  title,
  count,
  subtitle,
  action,
  children,
}: {
  title: string
  count: number
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-gloria text-lg">{title}</h2>
        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full">
          {count}
        </span>
        {subtitle && (
          <span className="text-xs font-mono text-muted-foreground/50 hidden sm:inline">
            {subtitle}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function PitchGrid({
  cards,
  slug,
  cycleSlug,
  today,
}: {
  cards: PitchCard[]
  slug: string
  cycleSlug: string
  today: string
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
}: {
  card: PitchCard
  slug: string
  cycleSlug: string
  today: string
  delay: number
}) {
  const pitchSlug = card.title.toLowerCase().replace(/\s+/g, '-')
  const zoneLabel = card.needle
    ? card.needle.zone.replace('_', ' ')
    : null
  const zoneColor = card.needle ? ZONE_COLORS[card.needle.zone] : undefined

  return (
    <Link
      href={`/${slug}/cycles/${cycleSlug}/${pitchSlug}`}
      className={cn(
        'rounded-xl border bg-card p-4 flex flex-col gap-3',
        'hover:shadow-[5px_5px_0_0_hsl(var(--foreground))] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all',
        'animate-in fade-in slide-in-from-bottom-2'
      )}
      style={{ animationDelay: `${delay}s`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center justify-between gap-2">
        <MiniNeedle needle={card.needle} />
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
          className="text-xs font-gloria self-start"
          style={{ color: zoneColor }}
        >
          {zoneLabel.charAt(0).toUpperCase() + zoneLabel.slice(1)}
        </span>
      )}

      <h3 className="font-gloria text-base leading-snug">{card.title}</h3>

      <TimeboxTape
        start={card.timebox_start}
        end={card.timebox_end}
        today={today}
        compact
      />

      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>
          {card.tasksDone}/{card.tasksTotal} tasks
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
          <DialogTitle className="font-gloria text-xl">
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
