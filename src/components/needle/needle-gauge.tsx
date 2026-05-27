'use client'

import { useCallback, useRef } from 'react'
import type { Needle, NeedleSnapshot } from '@/cycle-liveblocks.config'
import { deriveZone, clampProgress } from '@/lib/needle-engine'
import { ZONE_COLORS, NULL_COLOR } from './zone-colors'

const ARC_SAMPLES = 200
const WIDTH = 240
const HEIGHT = 140
const CX = 120
const CY = 130
const RX = 100
const RY = 90

function arcPoint(t: number) {
  const angle = Math.PI + t * Math.PI
  return {
    x: CX + RX * Math.cos(angle),
    y: CY + RY * Math.sin(angle),
  }
}

function arcPath() {
  const start = arcPoint(0)
  const end = arcPoint(1)
  return `M ${start.x} ${start.y} A ${RX} ${RY} 0 0 1 ${end.x} ${end.y}`
}

function hashMarks() {
  const marks = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const inner = arcPoint(t)
    const angle = Math.PI + t * Math.PI
    const outerX = CX + (RX + 8) * Math.cos(angle)
    const outerY = CY + (RY + 8) * Math.sin(angle)
    marks.push(
      <line
        key={i}
        x1={inner.x}
        y1={inner.y}
        x2={outerX}
        y2={outerY}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.4}
        className="hand-drawn"
      />
    )
  }
  return marks
}

type NeedleGaugeProps = {
  needle: Needle | null
  ghost?: NeedleSnapshot | null
  onProgressChange?: (progress: number) => void
  label?: string
  timestamp?: string
}

export function NeedleGauge({
  needle,
  ghost,
  onProgressChange,
  label,
  timestamp,
}: NeedleGaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onProgressChange || !svgRef.current) return

      const rect = svgRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top
      const scaleX = WIDTH / rect.width
      const scaleY = HEIGHT / rect.height
      const svgX = clickX * scaleX
      const svgY = clickY * scaleY

      let minDist = Infinity
      let bestT = 0.5
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        const t = i / ARC_SAMPLES
        const pt = arcPoint(t)
        const dist = Math.hypot(pt.x - svgX, pt.y - svgY)
        if (dist < minDist) {
          minDist = dist
          bestT = t
        }
      }

      onProgressChange(clampProgress(bestT))
    },
    [onProgressChange]
  )

  const color = needle ? ZONE_COLORS[needle.zone] : NULL_COLOR
  const progress = needle?.progress ?? 0
  const tipPoint = arcPoint(progress)
  const zoneLabel =
    needle === null
      ? 'Not yet set'
      : (label ?? needle.zone.replace(/_/g, ' '))

  const arcD = arcPath()
  const totalLength = Math.PI * Math.sqrt((RX * RX + RY * RY) / 2)
  const fillLength = progress * totalLength

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        onClick={handleClick}
        className={onProgressChange ? 'cursor-pointer' : ''}
      >
        <defs>
          <filter id="hand-drawn">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.04"
              numOctaves={4}
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={1.5}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        <g filter="url(#hand-drawn)">
          <path
            d={arcD}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            opacity={0.15}
            strokeLinecap="round"
          />

          {needle && (
            <path
              d={arcD}
              fill="none"
              stroke={color}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${fillLength} ${totalLength}`}
            />
          )}

          {hashMarks()}
        </g>

        {ghost && (
          <circle
            cx={arcPoint(ghost.progress).x}
            cy={arcPoint(ghost.progress).y}
            r={4}
            fill={ZONE_COLORS[ghost.zone]}
            opacity={0.3}
          />
        )}

        {needle && (
          <circle cx={tipPoint.x} cy={tipPoint.y} r={5} fill={color} />
        )}

        <text
          x={CX}
          y={CY - 15}
          textAnchor="middle"
          fontSize={14}
          fill={color}
          className="font-gloria"
        >
          {zoneLabel}
        </text>
      </svg>

      {timestamp && (
        <span className="text-xs text-muted-foreground">{timestamp}</span>
      )}
    </div>
  )
}
