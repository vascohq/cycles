'use client'

import { ClientSideSuspense } from '@liveblocks/react'
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

function Pitches({ cycleHref }: { cycleHref: string }) {
  const pitches = useCycleStorage((root) =>
    root.pitches.map((p) => ({ id: p.id, title: p.title, emoji: p.emoji })),
  )
  return pitches.map((p) => (
    <NavLink
      key={p.id}
      href={`${cycleHref}/${slugify(p.title)}`}
      depth={1}
      icon={<span className="text-sm leading-none">{p.emoji || '•'}</span>}
    >
      {p.title}
    </NavLink>
  ))
}
