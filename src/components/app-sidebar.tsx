'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Map, Rocket, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The sections of the app. One list for the gray rail, the phone menu and the
 * section part of every breadcrumb, so they never disagree.
 */
export function useSections() {
  // Both are null outside the App Router (Storybook).
  const slug = useParams<{ slug: string }>()?.slug
  const pathname = usePathname() ?? ''
  return [
    { href: `/${slug}/cycles`, match: `/${slug}/cycles`, label: 'Cycles', icon: Rocket },
    { href: `/${slug}/product`, match: `/${slug}/product`, label: 'Product Map', icon: Map },
    {
      href: `/${slug}/settings/integrations`,
      match: `/${slug}/settings`,
      label: 'Settings',
      icon: Settings,
    },
  ].map((s) => ({ ...s, active: pathname === s.match || pathname.startsWith(s.match + '/') }))
}

// The fixed icon rail in the gray zone: one entry per section of the app. It
// never expands; each section's own sidebar (SidebarLayout) is the one that
// collapses. Below md it is hidden and the phone menu lists the sections.
export function AppSidebar() {
  return (
    <nav
      aria-label="Sections"
      className="hidden w-16 shrink-0 flex-col items-center gap-3 pt-2 md:flex"
    >
      {useSections().map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className="group flex w-full flex-col items-center gap-1 px-1 text-center text-[11px] leading-tight text-muted-foreground"
        >
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-md transition-colors group-hover:bg-foreground/5 group-hover:text-foreground',
              active && 'bg-background text-foreground shadow-sm ring-1 ring-border',
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className={cn(active && 'font-medium text-foreground')}>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
