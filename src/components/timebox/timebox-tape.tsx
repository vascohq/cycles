'use client'

import { computeTimebox, dayTicks } from '@/lib/timebox-engine'

type TimeboxTapeProps = {
  start: string
  end: string
  today: string
  compact?: boolean
  done?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const pct = (n: number) => `${Math.min(Math.max(n, 0), 1) * 100}%`

export function TimeboxTape({
  start,
  end,
  today,
  compact = false,
  done = false,
}: TimeboxTapeProps) {
  const computed = computeTimebox(start, end, today)
  const info = done
    ? { ...computed, fractionElapsed: 1, phase: 'after' as const, daysLeft: 0 }
    : computed
  const ticks = dayTicks(info.totalDays)

  const track = (
    <div className={`relative w-full ${compact ? 'h-1.5' : 'h-2'}`}>
      {/* background track */}
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-current opacity-10" />

      {/* elapsed fill */}
      {info.phase !== 'before' && (
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-current opacity-40"
          style={{ width: pct(info.fractionElapsed) }}
        />
      )}

      {/* day ticks */}
      {ticks.map((tick, i) => (
        <div
          key={i}
          className={`absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-current ${
            tick.major ? 'h-3 opacity-30' : 'h-1.5 opacity-15'
          }`}
          style={{ left: pct(tick.position) }}
        />
      ))}

      {/* today marker */}
      {info.phase === 'active' && (
        <>
          <div
            className="absolute top-1/2 z-10 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-70"
            style={{ left: pct(info.fractionElapsed) }}
          />
          {!compact && (
            <div
              className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium tabular-nums text-background"
              style={{ left: pct(info.fractionElapsed) }}
            >
              today · day {info.dayNumber}
            </div>
          )}
        </>
      )}
    </div>
  )

  if (compact) {
    return <div className="w-full select-none text-foreground">{track}</div>
  }

  const status =
    info.phase === 'before'
      ? 'not started'
      : info.phase === 'after'
        ? 'complete'
        : `${info.daysLeft} days left`

  return (
    <div className="flex w-full select-none items-center gap-4 text-muted-foreground">
      <span className="shrink-0 text-xs tabular-nums">{formatDate(start)}</span>
      {track}
      <div className="flex shrink-0 items-baseline gap-2 text-xs tabular-nums">
        <span>{formatDate(end)}</span>
        <span className="opacity-70">{status}</span>
      </div>
    </div>
  )
}
