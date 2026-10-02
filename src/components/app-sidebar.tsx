'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, Rocket, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

// The fixed icon rail in the gray zone: one entry per section of the app. It
// never expands; each section's own sidebar (SidebarLayout) is the one that
// collapses.
export function AppSidebar({ slug }: { slug: string }) {
  const pathname = usePathname()
  const items: { href: string; match?: string; label: string; icon: typeof Map }[] = [
    { href: `/${slug}/cycles`, label: 'Cycles', icon: Rocket },
    { href: `/${slug}/product`, label: 'Map', icon: Map },
    { href: `/${slug}/settings/integrations`, match: `/${slug}/settings`, label: 'Settings', icon: Settings },
  ]

  return (
    <nav aria-label="Sections" className="hidden w-16 shrink-0 flex-col items-center gap-3 pt-2 md:flex">
      {items.map(({ href, match = href, label, icon: Icon }) => {
        const active = pathname === match || pathname.startsWith(match + '/')
        return (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-1 text-[11px] text-muted-foreground"
          >
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-md transition-colors group-hover:bg-foreground/5 group-hover:text-foreground',
                active && 'bg-background text-foreground shadow-sm ring-1 ring-border'
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className={cn(active && 'font-medium text-foreground')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
