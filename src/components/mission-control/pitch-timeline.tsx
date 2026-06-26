'use client'

import Link from 'next/link'
import { MiniNeedle } from '@/components/needle/mini-needle'
import { slugify } from '@/lib/slugify'
import { windowFraction } from '@/lib/timebox-engine'
import { cn } from '@/lib/utils'
import type { SquadSection } from '@/lib/mission-control-helpers'
import type { Stage } from '@/cycle-liveblocks.config'

// Each pitch is two stacked rows: a compact header (needle + name + stage) and
// the full-width timebox bar. The aligned Cycle window strip uses this same grid,
// so every bar — and the "now" line — spans the same width and lines up vertically.
export const TIMELINE_GRID = 'flex flex-col gap-2'

const STAGE_DOT: Record<Stage, string> = {
  framing: 'bg-slate-400',
  shaping: 'bg-blue-400',
  building: 'bg-amber-400',
  done: 'bg-emerald-500',
}

const pitchHref = (slug: string, cycleSlug: string, title: string) =>
  `/${slug}/cycles/${cycleSlug}/${slugify(title)}`

function SquadDot({ color }: { color?: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{
        backgroundColor: color ?? 'transparent',
        border: color ? undefined : '1px dashed currentColor',
      }}
    />
  )
}

function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[stage])} />
      {stage}
    </span>
  )
}

// A pitch is in Kanban mode when it has no timebox/appetite (see ADR 0018);
// otherwise it's a Shape-Up pitch. Shown so you can tell the two apart at a
// glance on Mission Control.
function ModeBadge({ kanban }: { kanban: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        kanban
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
          : 'border text-muted-foreground'
      )}
    >
      {kanban ? 'Kanban' : 'Shape Up'}
    </span>
  )
}

/**
 * The Mission Control pitch list as a timeline: pitches grouped by squad, each a
 * row whose timebox is a bar on a shared cycle-window scale (business days, ADR
 * 0013). Bars align with the aligned Cycle window strip above; a "now" line marks
 * today. Stage shows as a badge; done pitches are struck through and dimmed. A
 * pitch with no timebox shows "no timebox". Each row links to its Scope Map.
 */
export function PitchTimeline({
  sections,
  slug,
  cycleSlug,
  today,
  cycleStart,
  cycleEnd,
}: {
  sections: SquadSection[]
  slug: string
  cycleSlug: string
  today: string
  cycleStart?: string
  cycleEnd?: string
}) {
  if (!cycleStart || !cycleEnd) {
    return (
      <p className="text-sm text-muted-foreground">
        Set the cycle window to see the timeline.
      </p>
    )
  }
  const frac = (d: string) => windowFraction(cycleStart, cycleEnd, d)
  // timebox_end is the inclusive last day; its trailing edge is the day after.
  const dayAfter = (d: string) =>
    new Date(new Date(d + 'T00:00:00Z').getTime() + 86_400_000).toISOString().slice(0, 10)
  const todayFrac = frac(today)

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 px-1 pb-1.5 text-xs font-semibold">
            <SquadDot color={section.squad?.color} />
            {section.squad?.name ?? 'Unassigned'}
            <span className="font-normal text-muted-foreground">{section.cards.length}</span>
          </div>
          <div className="rounded-lg border bg-card divide-y overflow-hidden">
            {section.cards.map((card) => {
              const has = card.timebox_start && card.timebox_end
              const left = has ? frac(card.timebox_start) : 0
              const width = has ? Math.max(0.01, frac(dayAfter(card.timebox_end)) - left) : 0
              const color = section.squad?.color ?? '#94a3b8'
              return (
                <Link
                  key={card.id}
                  href={pitchHref(slug, cycleSlug, card.title)}
                  title={`${card.title} · ${card.stage}`}
                  className={cn(
                    TIMELINE_GRID,
                    'px-4 pt-2.5 pb-3 hover:bg-muted/40',
                    card.stage === 'done' && 'opacity-70'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* needle left of the name: scaled down and nudged up to center */}
                    <span className="flex shrink-0 items-center -translate-y-0.5 [&>svg]:h-5 [&>svg]:w-auto">
                      <MiniNeedle needle={card.needle} delay={0} />
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-medium',
                        card.stage === 'done' && 'line-through'
                      )}
                    >
                      {card.emoji && <span className="mr-1">{card.emoji}</span>}
                      {card.title}
                    </span>
                    <ModeBadge kanban={!has} />
                    <StageBadge stage={card.stage} />
                  </div>
                  <div className="relative h-2 rounded-full bg-muted/60">
                    {/* now line — same x as the cycle-window today marker */}
                    <span
                      className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
                      style={{ left: `${todayFrac * 100}%` }}
                    />
                    {has && (
                      <span
                        className="absolute top-[1px] bottom-[1px] rounded-full"
                        style={{ left: `${left * 100}%`, width: `${width * 100}%`, backgroundColor: color }}
                      />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
