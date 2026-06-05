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
import { readableTextColor } from '@/lib/color-engine'
import type { ScopeTrail } from '@/lib/hill-trail-engine'
import { rollupHillTrails } from '@/lib/hill-trail-engine'

export type HillScope = {
  id: string
  title: string
  tier: Tier
  hill_progress: number
  order: number
  /** Identity color for the dot (see ADR 0008). */
  color: string
  /** True for the pitch's Core Scope — dot carries a star accent (see ADR 0012). */
  isCore?: boolean
}

type HillChartProps = {
  scopes: HillScope[]
  trails?: ScopeTrail[]
  highlightedScopeId?: string | null
  onScopeHover?: (scopeId: string | null) => void
  onHillProgressChange?: (scopeId: string, progress: number) => void
  /** Resting dot radius; defaults to DOT_R. Smaller reads less crowded. */
  dotRadius?: number
  /** Dim non-highlighted scopes when one is highlighted. Only for paired
   *  before/after charts where the comparison is the point — off by default. */
  fadeOthers?: boolean
}

const SVG_PAD = 20
const VIEW_W = WIDTH + SVG_PAD * 2
// Just enough room below the baseline for the unknown/known labels — no excess
// whitespace pushing the legend down.
const VIEW_H = HEIGHT + SVG_PAD + 24

// Progress is discrete: scopes move along the hill in fixed steps rather than
// a continuous slider. Each step is a slot from "unknown" (0) to "done".
const STEP_COUNT = 12
const snapToStep = (p: number) =>
  Math.round(clamp(p, 0, 1) * STEP_COUNT) / STEP_COUNT
const stepIndexOf = (p: number) => Math.round(clamp(p, 0, 1) * STEP_COUNT)

// Dot radius (resting / hovered).
const DOT_R = 10
const DOT_R_ACTIVE = 13

// When several scopes share a step they stack vertically. Collapsed they sit in
// a tight pile (small upward offset); hovering fans them straight up into a
// column so the cursor stays over a pill and the motion reads coherently.
const DECK_DY = -3

const round = (n: number) => Math.round(n * 1000) / 1000
function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
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

// Path tracing the hill curve between two progress values — the trail a scope
// dot leaves behind as it moves from its last-update position to now.
function trailPath(fromP: number, toP: number): string {
  const samples = 40
  const a = Math.min(fromP, toP)
  const b = Math.max(fromP, toP)
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = a + ((b - a) * i) / samples
    const { x, y } = progressToPoint(t)
    pts.push(`${round(x + SVG_PAD)},${round(y + SVG_PAD)}`)
  }
  return `M ${pts.join(' L ')}`
}

export function HillChart({
  scopes,
  trails = [],
  highlightedScopeId,
  onScopeHover,
  onHillProgressChange,
  dotRadius,
  fadeOthers = false,
}: HillChartProps) {
  // Resting / hovered dot radii; the caller can shrink them (e.g. the dense
  // pitch-page chart). Label offsets scale with the dot so they don't overlap.
  const dotR = dotRadius ?? DOT_R
  const dotRActive = dotR + 3
  const dotFont = Math.max(5, Math.round(dotR * 0.8))
  // Vertical gap between fanned-out pills (just enough to not overlap).
  const fanSpacing = dotR * 2 + 4
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [hovered, setHovered] = useState<{
    x: number
    y: number
    r: number
    side: 'left' | 'right'
    title: string
    detail?: string
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

  const handlePointerDown = (
    scopeId: string,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.preventDefault()
    if (!onHillProgressChange) return
    setDraggingId(scopeId)
    setHovered(null)
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
  }

  const path = hillPath()
  const centerX = round(progressToPoint(0.5).x + SVG_PAD)

  const scopeById = new Map(scopes.map((s) => [s.id, s]))
  const trailById = new Map(trails.map((t) => [t.scopeId, t]))
  const newScopeIds = new Set(
    trails.filter((t) => t.state === 'new').map((t) => t.scopeId)
  )
  const rollup = rollupHillTrails(trails)

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
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full select-none"
        style={{ overflow: 'visible' }}
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
          fontSize={7}
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
          fontSize={7}
          fontWeight={500}
          letterSpacing={0.5}
          fill="currentColor"
          opacity={0.35}
        >
          KNOWN
        </text>

        {/* Trail layer: ghost at the last-update position + a neutral line to
            now. Drawn before the live dots so the dots paint on top. Neutral
            color throughout — regression reads from geometry, never alarm. */}
        <g style={{ pointerEvents: 'none' }}>
          {trails.map((trail) => {
            // Dropped: a lone named ghost at its last position. The scope is
            // gone from the live set, so there is no dot and no order number.
            if (trail.state === 'dropped') {
              const at = snapToStep(trail.fromProgress)
              const g = progressToPoint(at)
              const gx = round(g.x + SVG_PAD)
              const gy = round(g.y + SVG_PAD)
              return (
                <g key={`trail-${trail.scopeId}`}>
                  <circle
                    cx={gx}
                    cy={gy}
                    r={dotR}
                    fill="currentColor"
                    opacity={0.25}
                  />
                  {trail.title && (
                    <text
                      x={gx}
                      y={gy + dotR + 11}
                      textAnchor="middle"
                      fontSize={9}
                      fill="currentColor"
                      opacity={0.4}
                    >
                      {trail.title}
                    </text>
                  )}
                </g>
              )
            }
            if (trail.state !== 'moved') return null
            const scope = scopeById.get(trail.scopeId)
            if (!scope) return null
            const from = snapToStep(trail.fromProgress)
            const to = snapToStep(trail.toProgress)
            const g = progressToPoint(from)
            const gx = round(g.x + SVG_PAD)
            const gy = round(g.y + SVG_PAD)
            return (
              <g key={`trail-${trail.scopeId}`}>
                <path
                  d={trailPath(from, to)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.25}
                />
                <circle cx={gx} cy={gy} r={dotR} fill={scope.color} opacity={0.25} />
                <text
                  x={gx}
                  y={gy + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={dotFont}
                  fontWeight="bold"
                  fill={readableTextColor(scope.color)}
                  opacity={0.6}
                >
                  {scope.order}
                </text>
              </g>
            )
          })}
        </g>

        {clusterEntries.map(([step, members]) => {
          const n = members.length
          const expanded = expandedStep === step && n > 1
          const base = progressToPoint(step / STEP_COUNT)
          const cbx = round(base.x + SVG_PAD)
          const cby = round(base.y + SVG_PAD)

          return (
            <g
              key={`cluster-${step}`}
              onMouseEnter={n > 1 ? () => setExpandedStep(step) : undefined}
              onMouseLeave={() => {
                if (n > 1) setExpandedStep((s) => (s === step ? null : s))
                setHovered(null)
                onScopeHover?.(null)
              }}
            >
              {/* Transparent backdrop covering the fanned column keeps the
                  stack "hovered" while the pointer moves up between pills. */}
              {expanded && (
                <rect
                  x={cbx - dotR - 6}
                  y={cby - (n - 1) * fanSpacing - dotR - 6}
                  width={(dotR + 6) * 2}
                  height={(n - 1) * fanSpacing + (dotR + 6) * 2}
                  fill="transparent"
                  style={{ pointerEvents: 'all' }}
                />
              )}

              {members.map((scope, k) => {
                const isDragging = draggingId === scope.id
                const isHighlighted = highlightedScopeId === scope.id
                const r = isHighlighted || isDragging ? dotRActive : dotR
                const sw = isHighlighted || isDragging ? 2.5 : 1.5

                const progress =
                  isDragging && dragProgress !== null
                    ? dragProgress
                    : snapToStep(scope.hill_progress)
                const pt = progressToPoint(progress)
                const x = pt.x + SVG_PAD
                let y = pt.y + SVG_PAD

                // Stack straight up: tight pile when collapsed, spread column
                // when expanded — the cursor stays over the base pill.
                if (!isDragging && n > 1) {
                  y += k * (expanded ? -fanSpacing : DECK_DY)
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
                      const trail = trailById.get(scope.id)
                      const detail =
                        trail && trail.state !== 'dropped'
                          ? 'stepDelta' in trail
                            ? `${trail.label} · ${trail.stepDelta > 0 ? '+' : ''}${trail.stepDelta} ${Math.abs(trail.stepDelta) === 1 ? 'step' : 'steps'}`
                            : trail.label
                          : undefined
                      setHovered({
                        x: cx,
                        y: cy,
                        r,
                        // Sit to the right of the dot, flipping left near the
                        // right edge — never above, where the fan column lives.
                        side: cx > VIEW_W * 0.62 ? 'left' : 'right',
                        title: scope.title,
                        detail,
                      })
                    }}
                    style={{
                      transform: `translate(${cx}px, ${cy}px)`,
                      cursor: onHillProgressChange
                        ? isDragging
                          ? 'grabbing'
                          : 'grab'
                        : 'default',
                      // Fade the rest when another scope is highlighted so the
                      // focused one stands out — only in paired before/after charts.
                      opacity:
                        fadeOthers && highlightedScopeId && !isHighlighted ? 0.2 : 1,
                      transition: isDragging
                        ? 'none'
                        : 'transform 160ms ease, opacity 160ms ease',
                    }}
                  >
                    {newScopeIds.has(scope.id) && (
                      <circle
                        cx={0}
                        cy={0}
                        r={r + 5}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={0.4}
                      />
                    )}
                    <circle
                      cx={0}
                      cy={0}
                      r={r}
                      fill={scope.color}
                      stroke="white"
                      strokeWidth={sw}
                      style={{ transition: 'r 120ms ease' }}
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="central"
                      dy="0.05em"
                      fontSize={dotFont}
                      fontWeight={600}
                      fill={readableTextColor(scope.color)}
                    >
                      {scope.order}
                    </text>
                    {scope.isCore && (
                      // Subtle star accent on the heart of the pitch. The white
                      // halo (paint-order: stroke) detaches the amber from both
                      // the dot color and the page, so it reads on light and dark.
                      <text
                        data-core-accent={scope.id}
                        x={r * 0.92}
                        y={-r * 0.92}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.max(dotFont, 9)}
                        fill="#f59e0b"
                        stroke="white"
                        strokeWidth={1}
                        style={{ paintOrder: 'stroke', pointerEvents: 'none' }}
                        aria-label="Core scope"
                      >
                        ★
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-[180px] truncate rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
          style={{
            left: `${((hovered.x + (hovered.side === 'right' ? hovered.r + 8 : -(hovered.r + 8))) / VIEW_W) * 100}%`,
            top: `${(hovered.y / VIEW_H) * 100}%`,
            transform:
              hovered.side === 'right'
                ? 'translate(0, -50%)'
                : 'translate(-100%, -50%)',
            transition: 'left 160ms ease, top 160ms ease',
          }}
        >
          <div className="truncate">{hovered.title}</div>
          {hovered.detail && (
            <div className="text-[10px] font-normal opacity-70">
              {hovered.detail}
            </div>
          )}
        </div>
      )}
      </div>

      {trails.length > 0 && (
        <div className="flex gap-3 justify-center text-xs text-muted-foreground">
          <span>{rollup.moved} moved</span>
          <span>{rollup.stalled} unchanged</span>
          {rollup.new > 0 && <span>{rollup.new} new</span>}
          {rollup.dropped > 0 && <span>{rollup.dropped} dropped</span>}
        </div>
      )}

    </div>
  )
}
