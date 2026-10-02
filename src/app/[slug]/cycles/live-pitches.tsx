'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import { ChevronRight } from 'lucide-react'
import { NavLink } from '@/components/sidebar-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { CycleRoomProvider, cycleInitialStorage, useCycleStorage } from '@/cycle-room-context'
import { slugify } from '@/lib/slugify'

/**
 * A current cycle's pitches in the Cycles sidebar, read live from the cycle's
 * room: a pitch added, renamed or deleted shows at once, with no reload. The
 * provider shares the room connection with Mission Control's.
 */
export function LivePitches({ roomId, cycleHref }: { roomId: string; cycleHref: string }) {
  return (
    <CycleRoomProvider id={roomId} initialPresence={{}} initialStorage={cycleInitialStorage()}>
      <ClientSideSuspense
        fallback={
          <div className="flex flex-col gap-2 py-1 pl-8 pr-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        }
      >
        {() => <Pitches cycleHref={cycleHref} />}
      </ClientSideSuspense>
    </CycleRoomProvider>
  )
}

type SidebarPitch = { id: string; title: string; emoji?: string; squadId?: string }

function Pitches({ cycleHref }: { cycleHref: string }) {
  const pitches = useCycleStorage((root) =>
    root.pitches.map((p) => ({ id: p.id, title: p.title, emoji: p.emoji, squadId: p.squadId })),
  )
  const squads = useCycleStorage((root) =>
    root.squads.map((s) => ({ id: s.id, name: s.name, color: s.color })),
  )

  const links = (list: SidebarPitch[], depth: number) =>
    list.map((p) => (
      <NavLink
        key={p.id}
        href={`${cycleHref}/${slugify(p.title)}`}
        depth={depth}
        icon={<span className="text-sm leading-none">{p.emoji || '•'}</span>}
      >
        {p.title}
      </NavLink>
    ))

  // A cycle with no squads keeps the flat list: a lone "Unassigned" group is noise.
  if (squads.length === 0) return links(pitches, 1)

  // Same order as Mission Control: squads as declared, then Unassigned (no
  // squad, or a deleted one). Empty squads are left out.
  const known = new Set(squads.map((s) => s.id))
  const groups = [
    ...squads.map((s) => ({ key: s.id, name: s.name, color: s.color, pitches: pitches.filter((p) => p.squadId === s.id) })),
    { key: 'unassigned', name: 'Unassigned', color: undefined, pitches: pitches.filter((p) => !p.squadId || !known.has(p.squadId)) },
  ].filter((g) => g.pitches.length > 0)

  return groups.map((g) => (
    // ponytail: native <details>, open state is not remembered across reloads.
    <details key={g.key} open className="group/squad">
      <summary
        style={{ paddingLeft: 24 }}
        className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md pr-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <span
            className="size-2 rounded-full border border-muted-foreground/40"
            style={g.color ? { backgroundColor: g.color, borderColor: g.color } : undefined}
          />
        </span>
        <span className="min-w-0 flex-1 truncate">{g.name}</span>
        <span className="tabular-nums">{g.pitches.length}</span>
        <ChevronRight className="size-3 transition-transform group-open/squad:rotate-90" />
      </summary>
      <div className="flex flex-col gap-0.5">{links(g.pitches, 2)}</div>
    </details>
  ))
}
