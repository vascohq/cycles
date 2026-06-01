'use client'

import { useRef } from 'react'
import type { Zone, NeedleSnapshot } from '@/cycle-liveblocks.config'
import { NEEDLE_STEP_COUNT, snapNeedleProgress } from '@/lib/needle-engine'
import {
  type ArcConfig,
  arcPoint,
  arcPath,
  arcLength,
  fillLength,
  tangentTiltDeg,
  progressFromPoint,
} from './needle-geometry'
import { ZONE_COLORS, NULL_COLOR } from './zone-colors'

const WIDTH = 360
const HEIGHT = 150
const ARC: ArcConfig = { cx: 180, cy: 360, r: 300, sweepDeg: 60 }
// The needle moves in discrete steps; drag and arrow keys both snap to them.
const STEP = 1 / NEEDLE_STEP_COUNT
const TICKS = Array.from({ length: NEEDLE_STEP_COUNT + 1 }, (_, i) => i / NEEDLE_STEP_COUNT)

const round = (n: number) => Math.round(n * 1000) / 1000

type NeedleControlProps = {
  progress: number
  zone: Zone | null
  /** Where the needle sat at the last update — drawn as a dimmed marker. */
  ghost?: NeedleSnapshot | null
  onChange: (progress: number) => void
}

export function NeedleControl({ progress, zone, ghost, onChange }: NeedleControlProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const color = zone ? ZONE_COLORS[zone] : NULL_COLOR
  const tip = arcPoint(ARC, progress)
  const tilt = tangentTiltDeg(ARC, progress)
  const arcD = arcPath(ARC)
  const totalLength = arcLength(ARC)
  const fillLen = fillLength(ARC, progress)

  function progressFromEvent(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const local = pt.matrixTransform(ctm.inverse())
    return progressFromPoint(ARC, local.x, local.y)
  }

  function moveTo(clientX: number, clientY: number) {
    const next = progressFromEvent(clientX, clientY)
    if (next !== null) onChange(snapNeedleProgress(next))
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = true
    moveTo(e.clientX, e.clientY)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // No active pointer (e.g. synthetic event) — capture is best-effort.
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return
    moveTo(e.clientX, e.clientY)
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Best-effort release.
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(snapNeedleProgress(progress - STEP))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(snapNeedleProgress(progress + STEP))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(snapNeedleProgress(0))
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(snapNeedleProgress(1))
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="w-full max-w-[360px] touch-none cursor-pointer focus:outline-none"
      role="slider"
      tabIndex={0}
      aria-label="Needle position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <path
        d={arcD}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        opacity={0.14}
        strokeLinecap="round"
      />

      {TICKS.map((t) => {
        const p = arcPoint(ARC, t)
        const ux = (ARC.cx - p.x) / ARC.r
        const uy = (ARC.cy - p.y) / ARC.r
        return (
          <line
            key={t}
            x1={p.x}
            y1={p.y}
            x2={round(p.x + ux * 8)}
            y2={round(p.y + uy * 8)}
            stroke="currentColor"
            strokeWidth={1.5}
            opacity={0.25}
          />
        )
      })}

      <path
        d={arcD}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${fillLen} ${totalLength}`}
      />

      {/* Ghost: where the needle sat at the last update — a solid radial line
          across the arc, so it reads clearly as "the previous mark". */}
      {ghost &&
        (() => {
          const g = arcPoint(ARC, ghost.progress)
          const ux = (ARC.cx - g.x) / ARC.r
          const uy = (ARC.cy - g.y) / ARC.r
          return (
            <line
              x1={round(g.x - ux * 7)}
              y1={round(g.y - uy * 7)}
              x2={round(g.x + ux * 13)}
              y2={round(g.y + uy * 13)}
              stroke={ZONE_COLORS[ghost.zone]}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )
        })()}

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
    </svg>
  )
}
