'use client'

import { Suspense, useSyncExternalStore } from 'react'
import { PanelRight } from 'lucide-react'

import { MapCanvas } from '@/components/product-map/map-canvas'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { keepFrames } from '@/lib/frame-list'
import type { RenderedArea, RenderedPin } from '@/lib/product-map-engine'

import { FilterBar, useFilteredFrames } from './frame-filters'
import { FrameList } from './frame-list'
import { TopBar } from '@/components/sidebar-layout'
import { useUiPref } from '@/components/ui-prefs'

/** The width of the frame list beside the map. */
const PANEL = 380

/**
 * The map as the whole page: the breadcrumb in the top bar, the page's title,
 * the filters in a toolbar above the land, and the frame list in a right
 * sidebar that closes (a cookie remembers it, see ui-prefs). One set of
 * filters shapes the map and the list, so a pin on the land is always a row
 * in the list.
 *
 * Below the md breakpoint it stacks: toolbar, map, then the list, because a
 * phone has no room beside the land.
 */
export function MapWorkspace(props: {
  /** The breadcrumb, shown in the top bar. */
  title: React.ReactNode
  /** The page's own title row, above the toolbar: a name, a count. */
  heading?: React.ReactNode
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
  heading,
  areas,
  pins,
  onOpenFrame,
  footer,
  withUnmapped = false,
}: Parameters<typeof MapWorkspace>[0]) {
  const [hidden, setHidden] = useUiPref('framesHidden')
  const open = !hidden
  const wide = useWide()
  const { shown, keep } = useFilteredFrames(pins, areas)
  const showList = open || !wide
  const toggle = (
    <button
      type="button"
      onClick={() => setHidden(open)}
      aria-label={open ? 'Hide the frame list' : 'Show the frame list'}
      aria-expanded={open}
      title={open ? 'Hide the frame list' : 'Show the frame list'}
      className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
    >
      <PanelRight className="size-4" />
    </button>
  )

  return (
    // The screen's height, capped at the page area when the layout gives one,
    // so the map and the list each fit and scroll on their own.
    <main className="flex w-full flex-col md:h-[100dvh] md:max-h-full md:flex-row md:overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        {heading && <div className="shrink-0 px-4 pb-2 pt-4">{heading}</div>}
        <div className="flex min-h-12 shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <FilterBar areas={areas} withUnmapped={withUnmapped} />
          </div>
          {!open && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Frames · {shown.length}
              {toggle}
            </span>
          )}
        </div>
        <div className="relative h-[55vh] md:h-auto md:min-h-0 md:flex-1">
          <MapCanvas
            areas={keepFrames(areas, keep)}
            onOpenFrame={onOpenFrame}
            className="absolute inset-0 h-full min-h-0 rounded-none border-0"
          />
        </div>
      </div>

      {showList && (
        <aside
          className="flex flex-col border-t md:shrink-0 md:overflow-hidden md:border-l md:border-t-0"
          style={wide ? { width: PANEL } : undefined}
        >
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
            <h2 className="text-sm font-medium">
              Frames <span className="text-muted-foreground">· {shown.length}</span>
            </h2>
            {toggle}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 md:overflow-y-auto">
            <FrameList pins={shown} areas={areas} dense />
            {footer}
          </div>
        </aside>
      )}
    </main>
  )
}

/** True at the md breakpoint and wider, where the list sits beside the map. */
function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(min-width: 768px)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true,
  )
}

/**
 * The workspace in grey while the room loads, in the same shape as the real
 * one: the title row (when the page has one), the toolbar, the map, and the
 * list unless the viewer hid it. So nothing pushes the map down when it loads.
 */
export function WorkspaceSkeleton({ withHeading = false }: { withHeading?: boolean }) {
  const [hidden] = useUiPref('framesHidden')
  return (
    <main
      className="flex w-full flex-col md:h-[100dvh] md:max-h-full md:flex-row md:overflow-hidden"
      aria-busy="true"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {withHeading && (
          <div className="shrink-0 px-4 pb-2 pt-4">
            <Skeleton className="h-8 w-56" />
          </div>
        )}
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b px-3 py-1.5">
          {['w-16', 'w-16', 'w-16', 'w-16', 'w-20', 'w-24', 'w-24', 'w-32'].map((w, i) => (
            <Skeleton key={i} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
        <div className="h-[55vh] animate-pulse bg-muted/30 md:h-auto md:flex-1" />
      </div>
      {/* md:w-[380px] is PANEL. A class, not a style, so a phone stacks it. */}
      <div
        className={cn(
          'flex flex-col gap-2 border-t p-3 md:w-[380px] md:border-l md:border-t-0',
          hidden && 'md:hidden',
        )}
      >
        <Skeleton className="h-4 w-16" />
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
