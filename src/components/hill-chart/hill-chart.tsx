'use client'

import { useCallback, useRef, useState } from 'react'
import type { Tier } from '@/cycle-liveblocks.config'
import {
  progressToPoint,
  pointToProgress,
  WIDTH,
  HEIGHT,
  BASELINE_Y,
} from '@/lib/hill-engine'
import { TIER_COLORS } from './tier-colors'

export type HillScope = {
  id: string
  title: string
  tier: Tier
  hill_progress: number
  order: number
}

type HillChartProps = {
  scopes: HillScope[]
  highlightedScopeId?: string | null
  onScopeHover?: (scopeId: string | null) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
}

const SVG_PAD = 20
const VIEW_W = WIDTH + SVG_PAD * 2
const VIEW_H = HEIGHT + SVG_PAD * 2 + 20

// Progress is discrete: scopes move along the hill in fixed steps rather than
// a continuous slider. Each step is a slot from "unknown" (0) to "done".
const STEP_COUNT = 10
const snapToStep = (p: number) =>
  Math.round(clamp(p, 0, 1) * STEP_COUNT) / STEP_COUNT
const stepIndexOf = (p: number) => Math.round(clamp(p, 0, 1) * STEP_COUNT)

// When several scopes share a step they stack; hovering fans them out on an
// arc so each one is individually visible and draggable.
const FAN_RADIUS = 46
const DECK_DX = 3
const DECK_DY = -3

const round = (n: number) => Math.round(n * 1000) / 1000
function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

// Arc offset for member k of an n-scope stack at viewBox x `baseX`. The fan
// tilts away from the chart edges so dots near the corners stay on-canvas.
function fanOffset(baseX: number, k: number, n: number) {
  const norm = baseX / VIEW_W
  const center = (0.5 - norm) * 110
  const spread = Math.min(200, (n - 1) * 36)
  const angle = center - spread / 2 + (k * spread) / (n - 1)
  const rad = (angle * Math.PI) / 180
  return { dx: FAN_RADIUS * Math.sin(rad), dy: -FAN_RADIUS * Math.cos(rad) }
}

function hillPath(): string {
  const steps = 100
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const { x, y } = progressToPoint(t)
    pts.push(`${round(x + SVG_PAD)},${round(y + SVG_PAD)}`)
  }
  return `M ${pts.join(' L ')}`
}

export function HillChart({
  scopes,
  highlightedScopeId,
  onScopeHover,
  onHillProgressChange,
}: HillChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    text: string
  } | null>(null)

  const svgXFromEvent = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!svgRef.current) return 0
      const rect = svgRef.current.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const scale = VIEW_W / rect.width
      return (clientX - rect.left) * scale - SVG_PAD
    },
    []
  )

  const handlePointerDown = useCallback(
    (scopeId: string, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      if (!onHillProgressChange) return
      setDraggingId(scopeId)
      let latestProgress: number | null = null

      const handleMove = (ev: MouseEvent | TouchEvent) => {
        const x = svgXFromEvent(ev)
        const progress = snapToStep(pointToProgress(x))
        latestProgress = progress
        setDragProgress(progress)
      }

      const handleUp = () => {
        if (latestProgress !== null) {
          onHillProgressChange(scopeId, latestProgress)
        }
        setDraggingId(null)
        setDragProgress(null)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
        window.removeEventListener('touchmove', handleMove)
        window.removeEventListener('touchend', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
      window.addEventListener('touchmove', handleMove)
      window.addEventListener('touchend', handleUp)
    },
    [onHillProgressChange, svgXFromEvent]
  )

  const path = hillPath()
  const centerX = round(progressToPoint(0.5).x + SVG_PAD)

  // Group scopes by step. Each group renders as a stack that fans on hover.
  const clusters = new Map<number, HillScope[]>()
  for (const scope of scopes) {
    const key = stepIndexOf(scope.hill_progress)
    const arr = clusters.get(key) ?? []
    arr.push(scope)
    clusters.set(key, arr)
  }
  // Render the expanded stack last so its fanned dots sit above neighbours.
  const clusterEntries = [...clusters.entries()].sort((a, b) =>
    a[0] === expandedStep ? 1 : b[0] === expandedStep ? -1 : 0
  )

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full select-none"
      >
        <g>
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            opacity={0.3}
          />

          <line
            x1={centerX}
            y1={SVG_PAD}
            x2={centerX}
            y2={BASELINE_Y + SVG_PAD}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.2}
          />

          <line
            x1={SVG_PAD}
            y1={BASELINE_Y + SVG_PAD}
            x2={WIDTH + SVG_PAD}
            y2={BASELINE_Y + SVG_PAD}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.15}
          />

          {/* step markers along the curve */}
          {Array.from({ length: STEP_COUNT + 1 }, (_, i) => {
            const p = progressToPoint(i / STEP_COUNT)
            return (
              <circle
                key={`step-${i}`}
                cx={round(p.x + SVG_PAD)}
                cy={round(p.y + SVG_PAD)}
                r={2}
                fill="currentColor"
                opacity={0.2}
              />
            )
          })}
        </g>

        <text
          x={SVG_PAD + WIDTH * 0.2}
          y={BASELINE_Y + SVG_PAD + 16}
          textAnchor="middle"
          fontSize={9}
          fontWeight={500}
          letterSpacing={0.5}
          fill="currentColor"
          opacity={0.35}
        >
          UNKNOWN
        </text>
        <text
          x={SVG_PAD + WIDTH * 0.8}
          y={BASELINE_Y + SVG_PAD + 16}
          textAnchor="middle"
          fontSize={9}
          fontWeight={500}
          letterSpacing={0.5}
          fill="currentColor"
          opacity={0.35}
        >
          KNOWN
        </text>

        {clusterEntries.map(([step, members]) => {
          const n = members.length
          const expanded = expandedStep === step && n > 1
          const base = progressToPoint(step / STEP_COUNT)
          const cbx = round(base.x + SVG_PAD)
          const cby = round(base.y + SVG_PAD)

          return (
            <g
              key={`cluster-${step}`}
              onMouseEnter={
                n > 1 ? () => setExpandedStep(step) : undefined
              }
              onMouseLeave={
                n > 1
                  ? () => setExpandedStep((s) => (s === step ? null : s))
                  : undefined
              }
            >
              {/* Transparent backdrop keeps the stack "hovered" while the
                  pointer crosses the gaps between fanned dots. */}
              {expanded && (
                <circle
                  cx={cbx}
                  cy={cby}
                  r={FAN_RADIUS + 18}
                  fill="transparent"
                  style={{ pointerEvents: 'all' }}
                />
              )}

              {members.map((scope, k) => {
                const isDragging = draggingId === scope.id
                const isHighlighted = highlightedScopeId === scope.id
                const r = isHighlighted || isDragging ? 17 : 13
                const sw = isHighlighted || isDragging ? 2.5 : 1.5

                const progress =
                  isDragging && dragProgress !== null
                    ? dragProgress
                    : snapToStep(scope.hill_progress)
                const pt = progressToPoint(progress)
                let x = pt.x + SVG_PAD
                let y = pt.y + SVG_PAD

                if (!isDragging && n > 1) {
                  if (expanded) {
                    const { dx, dy } = fanOffset(x, k, n)
                    x += dx
                    y += dy
                  } else {
                    x += k * DECK_DX
                    y += k * DECK_DY
                  }
                }

                const cx = round(clamp(x, r, VIEW_W - r))
                const cy = round(clamp(y, r, VIEW_H - r))

                return (
                  <g
                    key={scope.id}
                    data-scope-dot={scope.id}
                    onMouseDown={(e) => handlePointerDown(scope.id, e)}
                    onTouchStart={(e) => handlePointerDown(scope.id, e)}
                    onMouseEnter={() => {
                      onScopeHover?.(scope.id)
                      setTooltip({ x: cx, y: cy - r - 8, text: scope.title })
                    }}
                    onMouseLeave={() => {
                      onScopeHover?.(null)
                      setTooltip(null)
                    }}
                    className={onHillProgressChange ? 'cursor-grab' : ''}
                    style={isDragging ? { cursor: 'grabbing' } : undefined}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={TIER_COLORS[scope.tier]}
                      stroke="white"
                      strokeWidth={sw}
                    />
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight="bold"
                      fill="white"
                    >
                      {scope.order}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltip.x - 50}
              y={tooltip.y - 18}
              width={100}
              height={20}
              rx={6}
              fill="hsl(var(--foreground))"
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 6}
              textAnchor="middle"
              fontSize={10}
              fontWeight={500}
              fill="hsl(var(--background))"
            >
              {tooltip.text.length > 16
                ? tooltip.text.slice(0, 14) + '…'
                : tooltip.text}
            </text>
            <polygon
              points={`${tooltip.x - 4},${tooltip.y + 2} ${tooltip.x + 4},${tooltip.y + 2} ${tooltip.x},${tooltip.y + 7}`}
              fill="hsl(var(--foreground))"
            />
          </g>
        )}
      </svg>

      <div className="flex gap-4 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: TIER_COLORS.must }}
          />
          Must
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: TIER_COLORS.should }}
          />
          Should
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: TIER_COLORS.could }}
          />
          Could
        </span>
      </div>
    </div>
  )
}
