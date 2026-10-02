import { auth } from '@clerk/nextjs/server'
import { Archive, CircleDashed, Rocket } from 'lucide-react'
import { CreateCycleDialog } from './create-cycle-dialog'
import { CreateCycleForm } from './create-cycle-form'
import { LivePitches } from './live-pitches'
import { NavGroup, NavLink, SidebarLayout } from '@/components/sidebar-layout'
import { groupCycles, type CycleSummary } from '@/lib/cycle-list-engine'
import { readCycleSummaries } from '@/lib/mcp/liveblocks-reader'
import { getTeamToday } from '@/lib/team-time'

/**
 * The Cycles sidebar answers "where is the work now": the current cycle with
 * its pitches one click away, what is coming up, and the past cycles. The
 * cycle list is room metadata, shared with the page in the same render (see
 * readCycleSummaries). The pitches come live from the room (LivePitches).
 */
export default async function CyclesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { userId, orgId } = await auth()
  if (!userId) return children

  const roomPrefix = orgId ?? userId
  const summaries = await readCycleSummaries(roomPrefix).catch(() => [])
  const groups = groupCycles(summaries, getTeamToday(new Date()))

  const cycleHref = (c: CycleSummary) => `/${slug}/cycles/${c.slug}`
  // Cycles have no emoji of their own; a cooldown gets the same 🧊 as Mission Control.
  const cycleIcon = (c: CycleSummary, fallback: React.ReactNode) =>
    c.type === 'cooldown' ? <span className="text-sm leading-none">🧊</span> : fallback

  return (
    <SidebarLayout
      title="Cycles"
      action={
        <CreateCycleDialog variant="sidebar">
          <CreateCycleForm />
        </CreateCycleDialog>
      }
      sidebar={
        <>
          <NavGroup label="Overview">
            <NavLink href={`/${slug}/cycles`} exact icon={<Rocket className="size-4" />}>
              All cycles
            </NavLink>
          </NavGroup>

          {groups.current.map((cycle) => (
            <NavGroup key={cycle.slug} label="Current">
              <NavLink
                href={cycleHref(cycle)}
                exact
                icon={cycleIcon(cycle, <CircleDashed className="size-4 text-primary" />)}
              >
                {cycle.title}
              </NavLink>
              <LivePitches
                roomId={`${roomPrefix}:cycle:${cycle.slug}`}
                cycleHref={cycleHref(cycle)}
              />
            </NavGroup>
          ))}

          {groups.upcoming.length > 0 && (
            <NavGroup label="Upcoming">
              {groups.upcoming.map((c) => (
                <NavLink
                  key={c.slug}
                  href={cycleHref(c)}
                  icon={cycleIcon(c, <CircleDashed className="size-4" />)}
                >
                  {c.title}
                </NavLink>
              ))}
            </NavGroup>
          )}

          {groups.past.length > 0 && (
            <NavGroup label="Past" closed>
              {groups.past.map((c) => (
                <NavLink
                  key={c.slug}
                  href={cycleHref(c)}
                  icon={cycleIcon(c, <Archive className="size-4" />)}
                >
                  {c.title}
                </NavLink>
              ))}
            </NavGroup>
          )}
        </>
      }
    >
      {children}
    </SidebarLayout>
  )
}
