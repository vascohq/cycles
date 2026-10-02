'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useCycleList } from '@/components/command-palette/palette-context'
import { useSections } from '@/components/app-sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type CrumbItem = { href: string; label: ReactNode; current?: boolean }

/**
 * A breadcrumb part that switches to a sibling: the label, a chevron, and a
 * menu of the other places at the same level. With an `href` (and not the
 * current page) the label goes there and only the chevron opens the menu.
 * `items` is null while loading; `onOpen` lets a caller fetch on the first
 * open, so a page pays nothing for a menu nobody opens.
 */
export function CrumbMenu({
  label,
  href,
  items,
  onOpen,
  current = false,
}: {
  label: ReactNode
  href?: string
  items: CrumbItem[] | null
  onOpen?: () => void
  /** The page itself, so the label reads as where you are. */
  current?: boolean
}) {
  const ring = 'rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
  const chevron = <ChevronDown className="size-3 shrink-0 opacity-60" />
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen?.()}>
      {href && !current ? (
        <span className="inline-flex min-w-0 items-center gap-0.5">
          <Link href={href} className={cn('truncate', ring)}>
            {label}
          </Link>
          <DropdownMenuTrigger aria-label="Switch to a sibling" className={cn('shrink-0 p-0.5', ring)}>
            {chevron}
          </DropdownMenuTrigger>
        </span>
      ) : (
        <DropdownMenuTrigger
          className={cn('inline-flex min-w-0 items-center gap-1', ring, current && 'font-medium text-foreground')}
        >
          <span className="truncate">{label}</span>
          {chevron}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {items === null ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn('flex items-center gap-2', item.current && 'font-medium')}
              >
                <span className="flex-1 truncate">{item.label}</span>
                {item.current && <Check className="size-3.5 shrink-0" />}
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The section part of a breadcrumb ("Cycles", "Product Map", "Settings"):
 * switches to another section of the app. The caller names its section, so
 * the label is right even where the URL is not a section's (e2e fixtures).
 */
export function SectionCrumb({
  section,
  current = false,
}: {
  section: 'Cycles' | 'Product Map' | 'Settings'
  current?: boolean
}) {
  const sections = useSections()
  return (
    <CrumbMenu
      label={section}
      href={sections.find((s) => s.label === section)?.href}
      current={current}
      items={sections.map((s) => ({
        href: s.href,
        label: s.label,
        current: s.label === section,
      }))}
    />
  )
}

/**
 * The cycle part of a breadcrumb: switches to any other cycle that is not
 * archived. The list is the command palette's, fetched once and shared.
 */
export function CycleCrumb({
  cycleSlug,
  label,
  current = false,
}: {
  cycleSlug: string
  label: ReactNode
  current?: boolean
}) {
  const list = useCycleList()
  if (!list) {
    return <span className={cn('truncate', current && 'font-medium text-foreground')}>{label}</span>
  }
  const items =
    list.cyclesLoading || list.cycles.length === 0
      ? null
      : list.cycles
          .filter((c) => !c.archived || c.slug === cycleSlug)
          .map((c) => ({
            href: `/${list.slug}/cycles/${c.slug}`,
            label: `${c.type === 'cooldown' ? '🧊 ' : ''}${c.title}`,
            current: c.slug === cycleSlug,
          }))
  return (
    <CrumbMenu
      label={label}
      href={`/${list.slug}/cycles/${cycleSlug}`}
      current={current}
      items={items}
      onOpen={list.ensureCycles}
    />
  )
}
