'use client'

import { computeTimebox, dayTicks } from '@/lib/timebox-engine'

type TimeboxTapeProps = {
  start: string
  end: string
  today: string
  compact?: boolean
  done?: boolean
}

const TRACK_W = 400
const FULL_H = 48
const COMPACT_H = 24
const TRACK_Y_FULL = 20
const TRACK_Y_COMPACT = 8
const TRACK_H_FULL = 6
const TRACK_H_COMPACT = 3

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TimeboxTape({ start, end, today, compact = false, done = false }: TimeboxTapeProps) {
  const computed = computeTimebox(start, end, today)
  const info = done
    ? { ...computed, fractionElapsed: 1, phase: 'after' as const, daysLeft: 0 }
    : computed
  const ticks = dayTicks(info.totalDays)

  const h = compact ? COMPACT_H : FULL_H
  const trackY = compact ? TRACK_Y_COMPACT : TRACK_Y_FULL
  const trackH = compact ? TRACK_H_COMPACT : TRACK_H_FULL
  const pad = 8

  const viewW = TRACK_W + pad * 2
  const viewH = h + pad * 2

  const filledW = TRACK_W * info.fractionElapsed
  const todayX = pad + filledW

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full select-none"
      style={{ maxWidth: viewW }}
    >
      <rect
        x={pad}
        y={trackY + pad}
        width={TRACK_W}
        height={trackH}
        rx={trackH / 2}
        fill="currentColor"
        opacity={0.1}
      />

      {info.phase !== 'before' && (
        <rect
          x={pad}
          y={trackY + pad}
          width={filledW}
          height={trackH}
          rx={trackH / 2}
          fill="currentColor"
          opacity={0.4}
        />
      )}

      {ticks.map((tick, i) => {
        const tx = pad + tick.position * TRACK_W
        const tickH = tick.major ? (compact ? 4 : 8) : (compact ? 2 : 4)
        return (
          <line
            key={i}
            x1={tx}
            y1={trackY + pad + trackH + 1}
            x2={tx}
            y2={trackY + pad + trackH + 1 + tickH}
            stroke="currentColor"
            strokeWidth={tick.major ? 1 : 0.5}
            opacity={tick.major ? 0.3 : 0.15}
          />
        )
      })}

      {info.phase === 'active' && (
        <>
          <line
            x1={todayX}
            y1={trackY + pad - (compact ? 2 : 4)}
            x2={todayX}
            y2={trackY + pad + trackH + (compact ? 3 : 6)}
            stroke="currentColor"
            strokeWidth={1.5}
            opacity={0.7}
          />

          {!compact && (
            <g>
              <rect
                x={todayX - 40}
                y={trackY + pad - 18}
                width={80}
                height={14}
                rx={7}
                fill="currentColor"
                opacity={0.15}
              />
              <text
                x={todayX}
                y={trackY + pad - 8}
                textAnchor="middle"
                fontSize={8}
                className="font-gloria"
                fill="currentColor"
                opacity={0.6}
              >
                today · day {info.dayNumber}
              </text>
            </g>
          )}
        </>
      )}

      {!compact && (
        <>
          <text
            x={pad}
            y={trackY + pad + trackH + (compact ? 10 : 22)}
            fontSize={8}
            fill="currentColor"
            opacity={0.35}
          >
            {formatDate(start)}
          </text>
          <text
            x={pad + TRACK_W}
            y={trackY + pad + trackH + 22}
            textAnchor="end"
            fontSize={8}
            fill="currentColor"
            opacity={0.35}
          >
            {formatDate(end)}
          </text>

          <text
            x={pad + TRACK_W}
            y={trackY + pad - 4}
            textAnchor="end"
            fontSize={9}
            className="font-gloria"
            fill="currentColor"
            opacity={0.5}
          >
            {info.phase === 'before'
              ? 'not started'
              : info.phase === 'after'
                ? 'complete'
                : `${info.daysLeft} days left`}
          </text>
        </>
      )}
    </svg>
  )
}
