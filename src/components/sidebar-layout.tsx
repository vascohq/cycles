'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { ChevronRight, Menu, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSections } from '@/components/app-sidebar'
import { useUiPref } from '@/components/ui-prefs'

// True inside a SidebarLayout. Static, so the server knows it too: a TopBar
// renders over the layout's header row on the first paint, with no portal.
const InLayout = createContext(false)

/**
 * A page's breadcrumb and buttons, shown in the section's top bar. It sits in
 * the page (the title often lives in a Liveblocks room the layout cannot read)
 * and is positioned over the layout's header row. Its containing block is the
 * layout's column, outside the page's scroll area, so it neither scrolls nor
 * clips. Until a page's bar renders, the header shows a skeleton.
 *
 * Outside a SidebarLayout (e2e fixtures, tests) it renders in place.
 */
export function TopBar({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  const inLayout = useContext(InLayout)
  const [closed] = useUiPref('sidebarClosed')
  const bar = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">{title}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </>
  )
  if (!inLayout) return <div className="flex min-w-0 items-center gap-3">{bar}</div>
  return (
    <div
      data-topbar
      // pl-12 clears the phone menu button; md:pl-14 clears the open toggle
      // when the sidebar is closed.
      className={cn(
        'absolute inset-x-0 top-0 z-10 flex h-12 items-center gap-3 border-b bg-background pl-12 pr-4',
        closed ? 'md:pl-14' : 'md:pl-4',
      )}
    >
      {bar}
    </div>
  )
}

/** The full-width button at the top of a sidebar, such as New cycle or Capture. */
export const SidebarButton = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  function SidebarButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-sm shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60',
          className,
        )}
        {...props}
      />
    )
  },
)

/**
 * A section of the app inside the white panel: a collapsible sidebar that holds
 * the section's own navigation, and the page beside it under a top bar. Closed,
 * the sidebar is gone and its toggle moves to the start of the top bar. One
 * cookie for every section, so it stays closed as you move around, and the
 * server renders it closed. Below md, a menu button opens the sections and the
 * sidebar in a drawer.
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
  const [closed, setClosed] = useUiPref('sidebarClosed')
  const [menuOpen, setMenuOpen] = useState(false)
  const nav = (
    // shrink-0 on every child: a long list overflows this column, and flex
    // would otherwise squash the buttons above it to fit.
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 [&>*]:shrink-0">
      {action}
      {sidebar}
    </div>
  )

  return (
    <InLayout.Provider value={true}>
      <div className="flex min-h-0 flex-1">
        {!closed && (
          <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 pl-4 pr-3">
              <p className="truncate text-base font-semibold">{title}</p>
              <Toggle label="Close sidebar" onClick={() => setClosed(true)} />
            </div>
            {nav}
          </aside>
        )}
        <div className="relative flex min-w-0 flex-1 flex-col [&:has([data-topbar])_[data-default]]:hidden">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
            {/* z-20: above a page's TopBar, which covers this row. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="relative z-20 -ml-1.5 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-4" />
            </button>
            {closed && (
              <span className="relative z-20 hidden md:block">
                <Toggle label="Open sidebar" onClick={() => setClosed(false)} />
              </span>
            )}
            <Skeleton data-default className="h-4 w-48" />
          </header>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          // Left drawer; the shared Sheet opens from the right by default.
          className="left-0 right-auto w-72 max-w-[85vw] gap-0 border-l-0 border-r p-0 pt-12 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          // A link inside closes the drawer, so it never covers the new page.
          onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SectionLinks />
          <p className="px-4 pb-2 pt-4 text-base font-semibold">{title}</p>
          {nav}
        </SheetContent>
      </Sheet>
    </InLayout.Provider>
  )
}

function SectionLinks() {
  return (
    <nav aria-label="Sections" className="flex gap-1 border-b px-3 pb-3">
      {useSections().map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[11px] text-muted-foreground hover:bg-muted',
            active && 'bg-muted font-medium text-foreground',
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Toggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
