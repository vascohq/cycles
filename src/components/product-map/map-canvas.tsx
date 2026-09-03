'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  clusterForViewport,
  descendantPins,
  type CanvasNode,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { unionBounds, type Bounds } from '@/lib/product-map-geometry'

/**
 * The land, drawn. One SVG, one viewBox, wheel and drag against it — the same
 * idiom as the hill chart, with no canvas library behind it.
 *
 * Only leaf areas have a drawn coastline. An island and an archipelago are the
 * merged silhouette of the leaves underneath them, fused by a blur-and-threshold
 * filter. Nothing about those two is stored or computed as a polygon.
 */

/** Breathing room round the fitted map, as a fraction of its size. */
const FIT_PAD = 0.12
const MIN_SPAN = 40

type View = { x: number; y: number; w: number; h: number }

export function MapCanvas({
  areas,
  onOpenFrame,
}: {
  areas: RenderedArea[]
  onOpenFrame: (frameId: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 960, height: 560 })
  const [view, setView] = useState<View | null>(null)

  const world = useMemo(() => {
    const box = unionBounds(areas.map((a) => a.bounds))
    if (!box) return { x: 0, y: 0, width: 400, height: 300 }
    // An island and an archipelago name themselves ABOVE their coastline, and
    // that label is not part of any area's box. Without headroom the fitted
    // view clips the top-level names clean off.
    const headroom = Math.max(40, box.height * 0.15)
    return { x: box.x, y: box.y - headroom, width: box.width, height: box.height + headroom }
  }, [areas])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // A collapsed or mid-layout host reports something like 278x2. Fitting to
    // that produces an aspect ratio in the hundreds, a viewBox tens of thousands
    // of units wide, and text scaled to thousands of pixels. Anything under this
    // is not a viewport worth fitting to, so the default box stands.
    const MIN_USEFUL = 80
    const measure = () => {
      const rect = host.getBoundingClientRect()
      if (rect.width >= MIN_USEFUL && rect.height >= MIN_USEFUL) {
        setBox({ width: rect.width, height: rect.height })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const fit = useCallback(
    (target: Bounds): View => {
      const padX = target.width * FIT_PAD + 20
      const padY = target.height * FIT_PAD + 20
      const w = Math.max(target.width + padX * 2, MIN_SPAN)
      const h = Math.max(target.height + padY * 2, MIN_SPAN)
      // Match the container's aspect, so fitting never squashes the coastline.
      const ratio = box.width / Math.max(box.height, 1)
      const span = w / h > ratio ? { w, h: w / ratio } : { w: h * ratio, h }
      return {
        x: target.x + target.width / 2 - span.w / 2,
        y: target.y + target.height / 2 - span.h / 2,
        w: span.w,
        h: span.h,
      }
    },
    [box.width, box.height]
  )

  // No view of their own means fitted to the whole map, recomputed each render —
  // so the fit is right as soon as the host is measured, and adding land while
  // nobody has touched the canvas refits instead of leaving the new area
  // offscreen. The first pan or zoom sets a view and takes over from here.
  //
  // Zoom is per-viewer and never persisted: two people at the betting table must
  // not yank each other's screen.
  const current = view ?? fit(world)
  const scale = box.width / current.w
  const nodes = useMemo(() => clusterForViewport(areas, scale), [areas, scale])

  const zoomAbout = useCallback((factor: number, wx: number, wy: number) => {
    setView((prev) => {
      const from = prev ?? fit(world)
      // The world is bounded, so "the whole map fits" IS fully zoomed out. Going
      // past it only shrinks the product into a speck in a corner, and it makes
      // clicking empty water to zoom out terminate somewhere useful.
      const widest = fit(world).w
      const w = clamp(from.w * factor, MIN_SPAN, widest)
      const h = from.h * (w / from.w)
      // Keep the point under the cursor where it is: that is what makes a wheel
      // zoom feel like a map rather than a slider.
      return clampView(
        {
          x: wx - ((wx - from.x) * w) / from.w,
          y: wy - ((wy - from.y) * h) / from.h,
          w,
          h,
        },
        world
      )
    })
  }, [fit, world])

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current
      if (!host) return { x: current.x, y: current.y }
      const rect = host.getBoundingClientRect()
      return {
        x: current.x + ((clientX - rect.left) / rect.width) * current.w,
        y: current.y + ((clientY - rect.top) / rect.height) * current.h,
      }
    },
    [current]
  )

  // Wheel zoom. Non-passive, because the page must not scroll instead.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const at = toWorld(e.clientX, e.clientY)
      zoomAbout(Math.exp(e.deltaY * 0.0015), at.x, at.y)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [toWorld, zoomAbout])

  const drag = useRef<{
    pointers: Map<number, { x: number; y: number }>
    span: number
    captured: boolean
  } | null>(null)
  const moved = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    // NO pointer capture here. While a pointer is captured, the derived `click`
    // is dispatched to the capture element — so capturing on pointerdown means a
    // click on a pin or a bubble never reaches that mark's own handler. Capture
    // is taken lazily, once the gesture turns out to be a drag (see below).
    const pointers = drag.current?.pointers ?? new Map()
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current = { pointers, span: pinchSpan(pointers), captured: false }
    moved.current = false
  }

  /** Hold the pointer once this is really a drag, so it survives leaving the canvas. */
  const holdPointer = (e: React.PointerEvent) => {
    const state = drag.current
    if (!state || state.captured) return
    state.captured = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const state = drag.current
    if (!state || !state.pointers.has(e.pointerId)) return
    const previous = state.pointers.get(e.pointerId)!
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (state.pointers.size >= 2) {
      // Pinch: the distance between two fingers drives the zoom, about their midpoint.
      holdPointer(e)
      const span = pinchSpan(state.pointers)
      if (state.span > 0 && span > 0) {
        const mid = midpoint(state.pointers)
        const at = toWorld(mid.x, mid.y)
        zoomAbout(state.span / span, at.x, at.y)
      }
      state.span = span
      moved.current = true
      return
    }

    const dx = ((e.clientX - previous.x) / box.width) * current.w
    const dy = ((e.clientY - previous.y) / box.height) * current.h
    if (Math.abs(e.clientX - previous.x) + Math.abs(e.clientY - previous.y) > 2) {
      moved.current = true
      holdPointer(e)
    }
    setView(clampView({ ...current, x: current.x - dx, y: current.y - dy }, world))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const state = drag.current
    if (!state) return
    state.pointers.delete(e.pointerId)
    state.span = pinchSpan(state.pointers)
    if (state.pointers.size === 0) drag.current = null
  }

  // Clicking empty water zooms out one level, so getting un-lost never needs a
  // control. Out about the point clicked, not about the centre: what you were
  // looking at stays where it was.
  const onBackgroundClick = (e: React.MouseEvent) => {
    if (moved.current) return
    const at = toWorld(e.clientX, e.clientY)
    zoomAbout(2, at.x, at.y)
  }

  const k = 1 / scale

  return (
    <div
      ref={hostRef}
      className="relative h-[min(70vh,620px)] min-h-[360px] w-full touch-none overflow-hidden rounded-xl border bg-muted/20"
    >
      {/*
        Absolutely positioned, so the SVG is OUT OF FLOW. An SVG carries an
        intrinsic size from its viewBox, and inside a shrink-to-fit parent that
        closes a loop: host width -> viewBox -> SVG intrinsic width -> host
        width. It never settles — the canvas shrinks about a pixel per frame,
        forever, and nothing on the page ever stops moving.
      */}
      <svg
        viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Product Map"
      >
        <defs>
          {/*
            The merged silhouette. Blur fuses neighbouring children, the alpha
            matrix hardens that haze back into one shape, and erode-then-composite
            leaves the coastline as a ring rather than a fill — areas are never
            colored by their frames.
          */}
          <Coast id="coast-island" blur={13} threshold={0.3} close={9} erode={2.2} k={k} />
          <Coast
            id="coast-archipelago"
            blur={30}
            threshold={0.16}
            close={16}
            erode={1.6}
            k={k}
          />
          {/* Hand-drawn character, on the drawn coastlines only. */}
          <filter id="pm-wobble" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        <rect
          x={current.x}
          y={current.y}
          width={current.w}
          height={current.h}
          fill="transparent"
          onClick={onBackgroundClick}
        />

        {nodes.map((node) =>
          node.kind === 'area' ? (
            <AreaShape key={`a-${node.area.areaId}`} area={node.area} k={k} scale={scale} />
          ) : null
        )}

        {nodes.map((node) =>
          node.kind === 'area' ? (
            // Only what the lens lets through, so the pins and the bubble counts
            // never disagree about how much is wrong in one place.
            node.area.pins
              .filter((pin) => pin.passesLens)
              .map((pin) => <Pin key={pin.frameId} pin={pin} k={k} onOpen={onOpenFrame} />)
          ) : (
            <Bubble
              key={`b-${node.areaId}`}
              node={node}
              k={k}
              onOpen={() => setView(fit(boundsOf(areas, node.areaId)))}
            />
          )
        )}
      </svg>
    </div>
  )
}

/**
 * The filter chain that turns a scatter of children into one coastline ring.
 *
 * `blur` is the fusion distance and stays in WORLD units, so an island's shape
 * does not shift as the map is zoomed.
 *
 * `threshold` is where the blurred haze becomes land, as an alpha value. It sets
 * how far apart two children still join up: a high threshold leaves a crisp edge
 * but refuses to bridge, which detaches the outlying areas of an island and
 * stops an archipelago wrapping its islands at all. The SLOPE gives the crisp
 * edge; the threshold decides what counts as land, and the two are independent.
 *
 * `close` is a dilate followed by an erode of the same radius. It fills the
 * pockets between three or more children, which would otherwise threshold into
 * holes and draw their own little rings floating inside the island.
 *
 * `erode` is the line weight, so it scales with `k` (1 / zoom) to hold a
 * constant thickness on screen.
 */
const EDGE_SLOPE = 160

function Coast({
  id,
  blur,
  threshold,
  close,
  erode,
  k,
}: {
  id: string
  blur: number
  threshold: number
  close: number
  erode: number
  k: number
}) {
  // out = SLOPE * alpha + offset, crossing 0.5 exactly at `threshold`.
  const offset = 0.5 - EDGE_SLOPE * threshold
  // feMorphology with a radius at or near zero produces no ring at all.
  const weight = Math.max(0.15, erode * k)

  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="haze" />
      <feColorMatrix
        in="haze"
        type="matrix"
        values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${EDGE_SLOPE} ${offset}`}
        result="hard"
      />
      <feMorphology in="hard" operator="dilate" radius={close} result="fat" />
      <feMorphology in="fat" operator="erode" radius={close} result="goo" />
      <feMorphology in="goo" operator="erode" radius={weight} result="inner" />
      <feComposite in="goo" in2="inner" operator="out" />
    </filter>
  )
}

/**
 * One area's land. A leaf draws its own coastline. An island or an archipelago
 * draws the merged silhouette of every leaf beneath it, so the outer shape always
 * wraps its children and there is no polygon union to compute.
 */
/**
 * A region narrower than this on screen cannot hold even a short word, and at
 * that size it is almost always standing in as a bubble anyway.
 */
const LABEL_AT_PX = 34
const LABEL_MAX_PX = 15
const LABEL_MIN_PX = 9
/** Rough width of one character as a fraction of the font size, for this stack. */
const CHAR_W = 0.55

/**
 * Fit a name into the width an area actually has. Small areas get smaller type,
 * and a name that still does not fit breaks onto a second line. Hiding the
 * label instead is worse: an unlabelled region tells the reader nothing.
 */
function fitLabel(name: string, availablePx: number): { lines: string[]; fontPx: number } {
  const oneLine = Math.min(LABEL_MAX_PX, availablePx / Math.max(name.length * CHAR_W, 1))
  if (oneLine >= LABEL_MIN_PX) {
    return { lines: [name], fontPx: Math.max(LABEL_MIN_PX, oneLine) }
  }

  // Break at the space that leaves the two halves closest in length, so neither
  // line sticks out further than it has to.
  const words = name.split(' ')
  if (words.length < 2) return { lines: [name], fontPx: LABEL_MIN_PX }

  let best = { lines: [name], longest: name.length }
  for (let i = 1; i < words.length; i++) {
    const top = words.slice(0, i).join(' ')
    const bottom = words.slice(i).join(' ')
    const longest = Math.max(top.length, bottom.length)
    if (longest < best.longest) best = { lines: [top, bottom], longest }
  }
  const twoLine = Math.min(LABEL_MAX_PX, availablePx / Math.max(best.longest * CHAR_W, 1))
  return { lines: best.lines, fontPx: Math.max(LABEL_MIN_PX, twoLine) }
}

function AreaShape({ area, k, scale }: { area: RenderedArea; k: number; scale: number }) {
  // Width, not the longest side: a label runs horizontally, so height buys it
  // nothing. A container is measured the same way, and its name sits above.
  const widthPx = area.bounds.width * scale
  const fitted = widthPx < LABEL_AT_PX ? null : fitLabel(area.name, widthPx * 1.1)
  const label = !fitted ? null : (
    <text
      x={area.labelAt[0]}
      y={area.labelAt[1]}
      textAnchor="middle"
      className="pointer-events-none select-none fill-foreground font-display"
      style={{ fontSize: fitted.fontPx * k, opacity: area.level === 'area' ? 0.9 : 0.55 }}
    >
      {fitted.lines.map((line, i) => (
        <tspan
          key={i}
          x={area.labelAt[0]}
          dy={i === 0 ? -((fitted.lines.length - 1) * fitted.fontPx * 0.55 * k) : fitted.fontPx * 1.1 * k}
        >
          {line}
        </tspan>
      ))}
    </text>
  )

  if (area.level === 'area') {
    return (
      <g>
        <path
          d={area.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          className="text-foreground/50"
          filter="url(#pm-wobble)"
        />
        {label}
      </g>
    )
  }

  // The silhouette is fed by the LEAF rings only, never by an inner filter's
  // output: nesting these chains is both slow and fragile.
  const rings = leafPaths(area)
  const island = area.level === 'island'
  return (
    <g>
      {/*
        The fade goes OUTSIDE the filter. A Tailwind /40 on the fill would feed
        its alpha into the threshold below and the silhouette would never appear
        at all — the archipelago layer is faint by design, so it is faded after
        the filter has run, not before.
      */}
      <g opacity={island ? 0.8 : 0.42}>
        <g
          filter={`url(#${island ? 'coast-island' : 'coast-archipelago'})`}
          className="text-foreground"
        >
          {rings.map((d, i) => (
            <path key={i} d={d} fill="currentColor" stroke="none" />
          ))}
        </g>
      </g>
      {label}
    </g>
  )
}

/**
 * A mark on the land has to be reachable without a mouse. The frame panels are
 * the fuller keyboard surface, but a pin is the ONLY route to a mapped frame now
 * that the pill rows are gone, so it is a real button: focusable, and activated
 * by Enter or Space.
 */
function activate(run: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    run()
  }
}

function Pin({
  pin,
  k,
  onOpen,
}: {
  pin: RenderedPin
  k: number
  onOpen: (frameId: string) => void
}) {
  if (!pin.at) return null
  const [x, y] = pin.at
  // Pins hold their size on screen. A pin that grew with the zoom would stop
  // being a marker and start being terrain.
  const halo = (pin.size / 2 + 10) * k
  const dot = 4.5 * k

  return (
    <g
      onClick={(e) => {
        e.stopPropagation()
        onOpen(pin.frameId)
      }}
      onKeyDown={activate(() => onOpen(pin.frameId))}
      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
      opacity={pin.opacity}
      role="button"
      tabIndex={0}
      aria-label={pin.problem}
    >
      {/* The browser's own tooltip. Costs a line and no JavaScript. */}
      <title>{`${pin.problem}${pin.reportCount > 0 ? ` — ${pin.reportCount} report${pin.reportCount === 1 ? '' : 's'}` : ''}`}</title>
      <circle cx={x} cy={y} r={halo} fill={pin.color} opacity={0.18} />
      {pin.outline !== 'none' && (
        <circle
          cx={x}
          cy={y}
          r={halo}
          fill="none"
          stroke={pin.color}
          strokeWidth={1.5}
          strokeDasharray={pin.outline === 'dashed' ? '4 3' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle cx={x} cy={y} r={dot} fill={pin.color} />
      {/* Investment shows as a mark and never as a number: sunk cost must not read as priority. */}
      {pin.worked && (
        <circle cx={x} cy={y} r={dot * 0.4} fill="white" opacity={0.9} />
      )}
    </g>
  )
}

function Bubble({
  node,
  k,
  onOpen,
}: {
  node: Extract<CanvasNode, { kind: 'bubble' }>
  k: number
  onOpen: () => void
}) {
  const [x, y] = node.at
  const r = 19 * k

  return (
    <g
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      onKeyDown={activate(onOpen)}
      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
      opacity={node.opacity}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}, ${node.count} frames. Zoom in.`}
    >
      <title>{`${node.name} — ${node.count} frame${node.count === 1 ? '' : 's'}. Click to zoom in.`}</title>
      <circle cx={x} cy={y} r={r * 1.45} fill={node.color} opacity={0.16} />
      <circle cx={x} cy={y} r={r} fill={node.color} />
      {node.outline !== 'none' && (
        <circle
          cx={x}
          cy={y}
          r={r * 1.45}
          fill="none"
          stroke={node.color}
          strokeWidth={1.5}
          strokeDasharray={node.outline === 'dashed' ? '4 3' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <text
        x={x}
        y={y + 5.5 * k}
        textAnchor="middle"
        fill="white"
        className="pointer-events-none select-none font-semibold"
        style={{ fontSize: 16 * k }}
      >
        {node.count}
      </text>
      <text
        x={x}
        y={y + r * 1.45 + 15 * k}
        textAnchor="middle"
        className="pointer-events-none select-none fill-foreground font-display"
        style={{ fontSize: 13 * k }}
      >
        {node.name}
      </text>
    </g>
  )
}

/** Every drawn coastline beneath an area. Only leaves have one. */
function leafPaths(area: RenderedArea): string[] {
  if (area.children.length === 0) return [area.path]
  return area.children.flatMap(leafPaths)
}

/** The box of one area anywhere in the tree, for zooming to it. */
function boundsOf(areas: RenderedArea[], areaId: string): Bounds {
  for (const area of areas) {
    if (area.areaId === areaId) return area.bounds
    const found = boundsOf(area.children, areaId)
    if (found.width > 0 || found.height > 0) return found
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

function pinchSpan(pointers: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pointers.values()]
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(pointers: Map<number, { x: number; y: number }>) {
  const [a, b] = [...pointers.values()]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * The world is bounded (there is only so much product), so the view's centre
 * stays inside the land. Without this you can pan or zoom out into blank water
 * and lose the map entirely, with nothing on screen to steer back by.
 */
function clampView(v: View, world: Bounds): View {
  const cx = clamp(v.x + v.w / 2, world.x, world.x + world.width)
  const cy = clamp(v.y + v.h / 2, world.y, world.y + world.height)
  return { ...v, x: cx - v.w / 2, y: cy - v.h / 2 }
}

/** Kept for the tray and the review queue, which count pins without drawing land. */
export { descendantPins }
