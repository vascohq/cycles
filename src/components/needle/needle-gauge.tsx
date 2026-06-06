'use client'

import type { Needle, NeedleSnapshot } from '@/cycle-liveblocks.config'
import {
  type ArcConfig,
  arcPoint,
  arcPath,
  arcLength,
  fillLength,
  tangentTiltDeg,
} from './needle-geometry'
import { ZONE_COLORS, NULL_COLOR } from './zone-colors'
import { useAnimatedProgress } from './use-animated-progress'

const WIDTH = 320
const HEIGHT = 132
const ARC: ArcConfig = { cx: 160, cy: 344, r: 280, sweepDeg: 60 }
const TICKS = [0, 0.25, 0.5, 0.75, 1]

const round = (n: number) => Math.round(n * 1000) / 1000

function tickMarks() {
  return TICKS.map((t) => {
    const p = arcPoint(ARC, t)
    // Short mark pointing inward (toward the circle center).
    const ux = (ARC.cx - p.x) / ARC.r
    const uy = (ARC.cy - p.y) / ARC.r
    return (
      <line
        key={t}
        x1={p.x}
        y1={p.y}
        x2={round(p.x + ux * 7)}
        y2={round(p.y + uy * 7)}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.25}
      />
    )
  })
}

type NeedleGaugeProps = {
  needle: Needle | null
  ghost?: NeedleSnapshot | null
  label?: string
  timestamp?: string
}

export function NeedleGauge({
  needle,
  ghost,
  label,
  timestamp,
}: NeedleGaugeProps) {
  const color = needle ? ZONE_COLORS[needle.zone] : NULL_COLOR
  const progress = useAnimatedProgress(needle?.progress ?? 0)
  const tip = arcPoint(ARC, progress)
  const tilt = tangentTiltDeg(ARC, progress)
  const arcD = arcPath(ARC)
  const totalLength = arcLength(ARC)
  const fillLen = fillLength(ARC, progress)

  const zoneLabel =
    needle === null
      ? 'Not yet set'
      : (label ?? needle.zone.replace(/_/g, ' '))

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="w-full max-w-[320px] overflow-visible"
      >
        {/* Tape track */}
        <path
          d={arcD}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          opacity={0.14}
          strokeLinecap="round"
        />

        {tickMarks()}

        {/* Zone-colored fill: length = position, color = zone */}
        {needle && (
          <path
            d={arcD}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${totalLength}`}
          />
        )}

        {/* Ghost: where the needle sat at the last update */}
        {ghost && (
          <circle
            cx={arcPoint(ARC, ghost.progress).x}
            cy={arcPoint(ARC, ghost.progress).y}
            r={4}
            fill={ZONE_COLORS[ghost.zone]}
            opacity={0.3}
          />
        )}

        {/* Chunky grip handle */}
        {needle && (
          <g transform={`translate(${tip.x} ${tip.y}) rotate(${tilt})`}>
            <polygon points="-6,-13 6,-13 0,1" fill={color} />
            <rect
              x={-9}
              y={-42}
              width={18}
              height={30}
              rx={5}
              className="fill-background"
              stroke={color}
              strokeWidth={2}
            />
            {[-4, 0, 4].map((dx) => (
              <line
                key={dx}
                x1={dx}
                y1={-32}
                x2={dx}
                y2={-22}
                stroke={color}
                strokeWidth={1.5}
                opacity={0.7}
              />
            ))}
          </g>
        )}
      </svg>

      <span
        className="text-sm font-medium capitalize"
        style={{ color }}
      >
        {zoneLabel}
      </span>
      {timestamp && (
        <span className="text-xs text-muted-foreground">{timestamp}</span>
      )}
    </div>
  )
}
