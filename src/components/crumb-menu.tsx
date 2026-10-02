'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useCycleList } from '@/components/command-palette/palette-context'
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
 * menu of the other places at the same level. `items` is null while loading;
 * `onOpen` lets a caller fetch on the first open, so a page pays nothing for a
 * menu nobody opens.
 */
export function CrumbMenu({
  label,
  items,
  onOpen,
  current = false,
}: {
  label: ReactNode
  items: CrumbItem[] | null
  onOpen?: () => void
  /** The page itself, so the label reads as where you are. */
  current?: boolean
}) {
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen?.()}>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex min-w-0 items-center gap-1 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          current && 'font-medium text-foreground',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
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
 * The cycle part of a breadcrumb: switches to any other cycle that is not
 * archived. The list is the command palette's, fetched once and shared.
 */
export function CycleCrumb({
  slug,
  cycleSlug,
  label,
  current = false,
}: {
  slug: string
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
            href: `/${slug}/cycles/${c.slug}`,
            label: `${c.type === 'cooldown' ? '🧊 ' : ''}${c.title}`,
            current: c.slug === cycleSlug,
          }))
  return <CrumbMenu label={label} current={current} items={items} onOpen={list.ensureCycles} />
}
