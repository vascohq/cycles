'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

// The collapsed flag is a per-viewer convenience, so it lives in localStorage.
// useSyncExternalStore renders expanded on the server, then the stored value
// after hydration, with no setState-in-effect and no hydration warning.
const KEY = 'sidebar-collapsed'
const EVENT = 'sidebar-collapsed-change'
const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const write = (collapsed: boolean) => {
  try {
    localStorage.setItem(KEY, collapsed ? '1' : '0')
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

// The top bar's DOM node, for a page to portal its title and buttons into.
// undefined = no SidebarLayout above (e2e fixtures, unit tests), so the bar
// renders in place; null = not mounted yet, so it renders nothing.
type Slot = HTMLElement | null | undefined
const TopBarSlot = createContext<Slot>(undefined)

/**
 * A page's title and main buttons, shown in the section's top bar. A portal,
 * because the title often lives deep in client state (a Liveblocks room) that
 * the layout cannot reach. Until it mounts, the bar shows a skeleton.
 */
export function TopBar({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  const slot = useContext(TopBarSlot)
  const bar = (
    <div data-topbar className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">{title}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
  // In place, a wrapper keeps the bar's flex-1 from stretching a column layout.
  if (slot === undefined) return <div className="flex">{bar}</div>
  return slot && createPortal(bar, slot)
}

/**
 * A section of the app inside the white panel: a collapsible sidebar that holds
 * the section's own navigation, and the page beside it under a top bar. Closed,
 * the sidebar is gone and its toggle moves to the start of the top bar. One
 * flag for every section, so it stays closed as you move around.
 */
export function SidebarLayout({
  title,
  action,
  sidebar,
  children,
}: {
  title: string
  action?: ReactNode
  sidebar: ReactNode
  children: ReactNode
}) {
  const collapsed = useSyncExternalStore(subscribe, read, () => false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  return (
    <TopBarSlot.Provider value={slot}>
      <div className="flex min-h-0 flex-1">
        {!collapsed && (
          <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 pl-4 pr-3">
              <p className="truncate text-base font-semibold">{title}</p>
              <Toggle collapsed={false} />
            </div>
            {/* shrink-0 on every child: a long list overflows this column, and
                flex would otherwise squash the buttons above it to fit. */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 [&>*]:shrink-0">
              {action}
              {sidebar}
            </div>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* A page's TopBar portals in after the placeholder, which then hides.
              A skeleton, not a generic title: while a live room loads, the bar
              would otherwise show one title and then jump to another. */}
          <header
            ref={setSlot}
            className="flex h-12 shrink-0 items-center gap-3 border-b px-4 [&:has(>[data-topbar])>[data-default]]:hidden"
          >
            {collapsed && <Toggle collapsed />}
            <Skeleton data-default className="h-4 w-48" />
          </header>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </TopBarSlot.Provider>
  )
}

function Toggle({ collapsed }: { collapsed: boolean }) {
  const label = collapsed ? 'Open sidebar' : 'Close sidebar'
  return (
    <button
      type="button"
      onClick={() => write(!collapsed)}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      // Hidden below md: there the sidebar never shows, so there is nothing to toggle.
      className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
    >
      <PanelLeft className="size-4" />
    </button>
  )
}

/** A labelled group of sidebar links. */
export function NavGroup({
  label,
  closed = false,
  children,
}: {
  label: string
  /** A group you open on demand, shut on first load. A native <details>. */
  closed?: boolean
  children: ReactNode
}) {
  if (closed) {
    return (
      <details className="group/nav">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 pb-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          {label}
          <ChevronRight className="size-3 transition-transform group-open/nav:rotate-90" />
        </summary>
        <nav className="flex flex-col gap-0.5" aria-label={label}>
          {children}
        </nav>
      </details>
    )
  }
  return (
    <nav className="flex flex-col gap-0.5" aria-label={label}>
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </nav>
  )
}

/**
 * One sidebar link. Active when the URL is the link or below it, unless
 * `exact` (for a section root that every page sits under).
 */
export function NavLink({
  href,
  icon,
  count,
  depth = 0,
  exact = false,
  children,
}: {
  href: string
  icon?: ReactNode
  count?: number
  depth?: number
  exact?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      style={{ paddingLeft: 8 + depth * 16 }}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md pr-2 text-sm text-foreground/80 transition-colors hover:bg-muted',
        active && 'bg-muted font-medium text-foreground',
      )}
    >
      {icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
    </Link>
  )
}
