'use client'

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { List, X } from 'lucide-react'

import { MapCanvas } from '@/components/product-map/map-canvas'
import { Skeleton } from '@/components/ui/skeleton'
import { keepFrames } from '@/lib/frame-list'
import type { RenderedArea, RenderedPin } from '@/lib/product-map-engine'

import { FilterBar, useFilteredFrames } from './frame-filters'
import { FrameList } from './frame-list'

/** The floating list's width, and the gap round it. The map fits beside both. */
const PANEL = 420
const GAP = 12

/**
 * The map as the whole page, with everything else floating over it: a title
 * bar and the filters at the top left, and the frame list on the right. One
 * set of filters shapes the map and the list, so a pin on the land is always a
 * row in the list.
 *
 * Below the md breakpoint nothing floats: the map takes the top of the screen
 * and the list follows it, because a phone has no room beside the land.
 */
export function MapWorkspace(props: {
  /** The heading row: a title, a breadcrumb, a count. */
  title: React.ReactNode
  /** At the right of the heading row, such as Capture. */
  actions?: React.ReactNode
  /** The land to draw. */
  areas: RenderedArea[]
  /** Every frame the list and the map can show, before the filters. */
  pins: RenderedPin[]
  onOpenFrame: (frameId: string) => void
  /** Under the list, inside the panel: the dormant review queue. */
  footer?: React.ReactNode
  /** The Area filter offers Unmapped. Only the whole map holds those frames. */
  withUnmapped?: boolean
}) {
  return (
    <Suspense>
      <Workspace {...props} />
    </Suspense>
  )
}

function Workspace({
  title,
  actions,
  areas,
  pins,
  onOpenFrame,
  footer,
  withUnmapped = false,
}: Parameters<typeof MapWorkspace>[0]) {
  const [open, setOpen] = useState(true)
  const wide = useWide()
  const { shown, keep } = useFilteredFrames(pins, areas)
  const floating = wide && open
  // The land fits below the toolbar and beside the list.
  const [toolbar, toolbarHeight] = useHeight<HTMLDivElement>()

  return (
    // h-16 is the app header, so the map fills exactly what is left.
    <main className="relative w-full md:h-[calc(100vh-4rem)] md:overflow-hidden">
      {/* The toolbar comes first, so a phone shows it above the map. Wide,
          it floats and the order does not show. */}
      <div
        ref={toolbar}
        className="relative z-10 flex flex-col gap-2 p-3 md:absolute md:left-0 md:top-0 md:p-3"
        style={wide ? { right: floating ? PANEL + GAP : 0 } : undefined}
      >
        <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur">
          <div className="min-w-0 flex-1">{title}</div>
          {actions}
        </div>
        <div className="self-start rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
          <FilterBar areas={areas} withUnmapped={withUnmapped} />
        </div>
      </div>

      <MapCanvas
        areas={keepFrames(areas, keep)}
        onOpenFrame={onOpenFrame}
        inset={wide ? { top: toolbarHeight, right: floating ? PANEL + GAP * 2 : 0 } : undefined}
        className="h-[55vh] rounded-none border-x-0 border-t-0 md:absolute md:inset-0 md:h-full md:min-h-0 md:border-0"
      />

      {floating || !wide ? (
        <aside
          className="relative z-10 flex flex-col p-3 pt-0 md:absolute md:bottom-3 md:right-3 md:top-3 md:overflow-hidden md:rounded-xl md:border md:bg-background/95 md:p-0 md:shadow-lg md:backdrop-blur"
          style={wide ? { width: PANEL } : undefined}
        >
          <div className="flex items-center justify-between py-2 md:border-b md:px-3">
            <h2 className="font-display text-sm">Frames</h2>
            {wide && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Hide the list"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 md:overflow-y-auto md:p-3">
            <FrameList pins={shown} areas={areas} dense />
            {footer}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow"
        >
          <List className="h-3.5 w-3.5" /> Frames · {shown.length}
        </button>
      )}
    </main>
  )
}

/** True at the md breakpoint and wider, where the panels float over the map. */
function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(min-width: 768px)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true
  )
}

/** A ref and the live height of the element it lands on, 0 before it mounts. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}

/**
 * The workspace in grey while the room loads: the map fills the page, the
 * toolbar sits top left, and the list panel floats on the right.
 */
export function WorkspaceSkeleton() {
  return (
    <main className="relative w-full md:h-[calc(100vh-4rem)] md:overflow-hidden" aria-busy="true">
      {/* md:right-[432px] and md:w-[420px] are PANEL + GAP and PANEL. Classes,
          not styles, so that on a phone nothing floats here either. */}
      <div className="relative z-10 flex flex-col gap-2 p-3 md:absolute md:left-0 md:right-[432px] md:top-0">
        <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="ml-auto h-7 w-20 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-2 self-start rounded-xl border bg-background p-2">
          {['w-16', 'w-16', 'w-16', 'w-16', 'w-20', 'w-24', 'w-24', 'w-32'].map((w, i) => (
            <Skeleton key={i} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
      </div>
      <div className="h-[55vh] animate-pulse bg-muted/30 md:absolute md:inset-0 md:h-full" />
      <div className="relative z-10 flex flex-col gap-2 p-3 md:absolute md:bottom-3 md:right-3 md:top-3 md:w-[420px] md:rounded-xl md:border md:bg-background">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1.5">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </main>
  )
}
