import { auth } from '@clerk/nextjs/server'
import { Archive, CircleDashed, Rocket } from 'lucide-react'
import { CreateCycleDialog } from './create-cycle-dialog'
import { CreateCycleForm } from './create-cycle-form'
import { NavGroup, NavLink, SidebarLayout } from '@/components/sidebar-layout'
import { groupCycles, type CycleSummary } from '@/lib/cycle-list-engine'
import { getCycleStorage, listCycleRooms } from '@/lib/mcp/liveblocks-reader'
import { getTeamToday } from '@/lib/team-time'
import { slugify } from '@/lib/slugify'

// ponytail: past cycles in the sidebar stop at 3, the cycles page lists all.
const RECENT_PAST = 3

/**
 * The Cycles sidebar answers "where is the work now": the current cycle with
 * its pitches one click away, what is coming up, and the last few cycles.
 * Layouts keep their data across client navigation, so a pitch added in this
 * session shows here after a reload.
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
  const rooms = await listCycleRooms(roomPrefix).catch(() => [])
  const summaries: CycleSummary[] = rooms.map((r) => ({
    slug: r.slug,
    title: r.name || 'Untitled cycle',
    type: r.type === 'cooldown' ? 'cooldown' : 'build',
    start_date: r.start_date,
    end_date: r.end_date,
    archived: r.archived,
  }))
  const groups = groupCycles(summaries, getTeamToday(new Date()))

  // One storage read per current cycle, the same cost as the cycles page.
  const current = await Promise.all(
    groups.current.map(async (cycle) => {
      const pitches = await getCycleStorage(roomPrefix, cycle.slug)
        .then((s) => s.pitches)
        .catch(() => [])
      return { cycle, pitches }
    })
  )

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

          {current.map(({ cycle, pitches }) => (
            <NavGroup key={cycle.slug} label="Current">
              <NavLink
                href={cycleHref(cycle)}
                exact
                icon={cycleIcon(cycle, <CircleDashed className="size-4 text-primary" />)}
              >
                {cycle.title}
              </NavLink>
              {pitches.map((p) => (
                <NavLink
                  key={p.id}
                  href={`${cycleHref(cycle)}/${slugify(p.title)}`}
                  depth={1}
                  icon={<span className="text-sm leading-none">{p.emoji || '•'}</span>}
                >
                  {p.title}
                </NavLink>
              ))}
            </NavGroup>
          ))}

          {groups.upcoming.length > 0 && (
            <NavGroup label="Upcoming">
              {groups.upcoming.map((c) => (
                <NavLink key={c.slug} href={cycleHref(c)} icon={cycleIcon(c, <CircleDashed className="size-4" />)}>
                  {c.title}
                </NavLink>
              ))}
            </NavGroup>
          )}

          {groups.past.length > 0 && (
            <NavGroup label="Past" closed>
              {groups.past.slice(0, RECENT_PAST).map((c) => (
                <NavLink key={c.slug} href={cycleHref(c)} icon={cycleIcon(c, <Archive className="size-4" />)}>
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
