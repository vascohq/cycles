'use client'

import { useCallback, useRef, useState } from 'react'
import type { Tier } from '@/cycle-liveblocks.config'
import {
  progressToPoint,
  pointToProgress,
  clampHillProgress,
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

const round = (n: number) => Math.round(n * 1000) / 1000
const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

// Scopes sharing (nearly) the same hill position would stack into one dot and
// become impossible to select or drag individually. Fan each cluster out in a
// small diagonal cascade so every dot stays visible and grabbable. The offset
// is purely visual — dragging still maps the pointer to progress.
const STAGGER_EPS = 0.05
const STAGGER_DX = 9
const STAGGER_DY = -8

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
        const progress = clampHillProgress(pointToProgress(x))
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

  const clusterCounts = new Map<number, number>()
  const staggerIndex = new Map<string, number>()
  for (const scope of scopes) {
    const key = Math.round(scope.hill_progress / STAGGER_EPS)
    const idx = clusterCounts.get(key) ?? 0
    clusterCounts.set(key, idx + 1)
    staggerIndex.set(scope.id, idx)
  }

  // Render the highlighted dot last so hovering a partially-covered scope
  // brings it fully to the front.
  const renderScopes = highlightedScopeId
    ? [...scopes].sort((a, b) =>
        a.id === highlightedScopeId ? 1 : b.id === highlightedScopeId ? -1 : 0
      )
    : scopes

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

        {renderScopes.map((scope) => {
          const isDragging = draggingId === scope.id
          const progress =
            isDragging && dragProgress !== null
              ? dragProgress
              : scope.hill_progress
          const pt = progressToPoint(progress)
          const isHighlighted = highlightedScopeId === scope.id
          const r = isHighlighted || isDragging ? 17 : 13
          const stagger = isDragging ? 0 : staggerIndex.get(scope.id) ?? 0
          const cx = round(
            clamp(pt.x + SVG_PAD + stagger * STAGGER_DX, r, VIEW_W - r)
          )
          const cy = round(
            clamp(pt.y + SVG_PAD + stagger * STAGGER_DY, r, VIEW_H - r)
          )
          const sw = isHighlighted || isDragging ? 2.5 : 1.5

          return (
            <g
              key={scope.id}
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

        {tooltip && (
          <g>
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
