import { CreateCycleDialog } from '@/app/[slug]/cycles/create-cycle-dialog'
import { CreateCycleForm } from '@/app/[slug]/cycles/create-cycle-form'
import { EditCycleButton } from '@/app/[slug]/cycles/[cycleSlug]/edit-cycle-dialog'
import { TimeboxTape } from '@/components/timebox'
import {
  groupCycles,
  type CycleSummary,
} from '@/lib/cycle-list-engine'
import { liveblocks } from '@/lib/liveblocks'
import { getCycleStorage } from '@/lib/mcp/liveblocks-reader'
import { computeTimebox } from '@/lib/timebox-engine'
import { getTeamToday } from '@/lib/team-time'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Cycles | Cycles',
}

function formatDate(iso: string): string {
  // ISO date is a wall-clock day; pin to UTC so it never shifts by a timezone.
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function typeLabel(type: CycleSummary['type']): string {
  return type === 'cooldown' ? 'Cooldown' : 'Build cycle'
}

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/cycles`)

  const roomPrefix = orgId ?? userId
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${roomPrefix}:cycle:"`,
  })

  const today = getTeamToday(new Date())
  const summaries: CycleSummary[] = rooms.map((room) => ({
    slug: room.id.split(':').slice(2).join(':'),
    title: String(room.metadata.title ?? 'Untitled cycle'),
    type: room.metadata.type === 'cooldown' ? 'cooldown' : 'build',
    start_date: room.metadata.start_date ? String(room.metadata.start_date) : '',
    end_date: room.metadata.end_date ? String(room.metadata.end_date) : '',
    archived: room.metadata.archived === 'true',
  }))

  const groups = groupCycles(summaries, today)

  // Pitch counts only for the Current hero(s) — one storage read each. The other
  // groups stay metadata-only so the list is cheap regardless of cycle count.
  const pitchCounts = new Map<string, number>()
  await Promise.all(
    groups.current.map(async (c) => {
      try {
        const storage = await getCycleStorage(roomPrefix, c.slug)
        pitchCounts.set(c.slug, storage.pitches.length)
      } catch {
        // A current cycle with unreadable storage still renders, just without a count.
      }
    })
  )

  const isEmpty = summaries.length === 0

  return (
    <main className="w-full max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-display">Cycles</h1>
        <CreateCycleDialog>
          <CreateCycleForm />
        </CreateCycleDialog>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed rounded-xl p-12 text-center">
          <p className="font-display text-lg">Start your first cycle</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            A cycle is a fixed time box for your pitches. Create one to open
            Mission Control.
          </p>
          <CreateCycleDialog>
            <CreateCycleForm />
          </CreateCycleDialog>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.current.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel>Current</SectionLabel>
              {groups.current.map((c) => (
                <CurrentCycleCard
                  key={c.slug}
                  cycle={c}
                  today={today}
                  href={`/${urlSlug}/cycles/${c.slug}`}
                  pitchCount={pitchCounts.get(c.slug)}
                />
              ))}
            </section>
          )}

          {groups.upcoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionLabel>Upcoming</SectionLabel>
              <ul className="border rounded-lg divide-y">
                {groups.upcoming.map((c) => (
                  <CycleRow
                    key={c.slug}
                    cycle={c}
                    href={`/${urlSlug}/cycles/${c.slug}`}
                    detail={`Starts ${formatDate(c.start_date)}`}
                  />
                ))}
              </ul>
            </section>
          )}

          {groups.past.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
                Show {groups.past.length} past{' '}
                {groups.past.length === 1 ? 'cycle' : 'cycles'}
              </summary>
              <ul className="mt-3 border rounded-lg divide-y opacity-60">
                {groups.past.map((c) => (
                  <CycleRow
                    key={c.slug}
                    cycle={c}
                    href={`/${urlSlug}/cycles/${c.slug}`}
                    detail={`${formatDate(c.start_date)} → ${formatDate(c.end_date)}`}
                  />
                ))}
              </ul>
            </details>
          )}

          {groups.undated.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionLabel>Undated</SectionLabel>
              <ul className="border rounded-lg divide-y">
                {groups.undated.map((c) => (
                  <CycleRow
                    key={c.slug}
                    cycle={c}
                    href={`/${urlSlug}/cycles/${c.slug}`}
                    detail="No dates set"
                  />
                ))}
              </ul>
            </section>
          )}

          {groups.archived.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
                Show {groups.archived.length} archived{' '}
                {groups.archived.length === 1 ? 'cycle' : 'cycles'}
              </summary>
              <ul className="mt-3 border rounded-lg divide-y opacity-60">
                {groups.archived.map((c) => (
                  <CycleRow
                    key={c.slug}
                    cycle={c}
                    href={`/${urlSlug}/cycles/${c.slug}`}
                    detail="Archived"
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </main>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

function CurrentCycleCard({
  cycle,
  today,
  href,
  pitchCount,
}: {
  cycle: CycleSummary
  today: string
  href: string
  pitchCount: number | undefined
}) {
  const info = computeTimebox(cycle.start_date, cycle.end_date, today)
  const weekLabel = `Week ${info.currentWeek} of ${info.totalWeeks}`

  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-lg">{cycle.title}</span>
          <span className="text-xs text-muted-foreground">
            {typeLabel(cycle.type)}
            {pitchCount !== undefined &&
              ` · ${pitchCount} ${pitchCount === 1 ? 'pitch' : 'pitches'}`}
          </span>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">
          {weekLabel}
        </span>
      </div>
      <TimeboxTape start={cycle.start_date} end={cycle.end_date} today={today} />
    </Link>
  )
}

function CycleRow({
  cycle,
  href,
  detail,
}: {
  cycle: CycleSummary
  href: string
  detail: string
}) {
  return (
    <li className="flex items-center">
      <Link
        href={href}
        className="flex flex-1 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{cycle.title}</span>
          <span className="text-xs text-muted-foreground">
            {typeLabel(cycle.type)}
          </span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {detail}
        </span>
      </Link>
      {/* Actions sit outside the Link so clicking "…" never navigates. */}
      <div className="pr-2">
        <CycleActions cycle={cycle} />
      </div>
    </li>
  )
}

// The per-row/-card "…" menu: Edit + Archive/Unarchive. A thin wrapper over the
// shared EditCycleButton so the list and the cycle page use one control.
function CycleActions({ cycle }: { cycle: CycleSummary }) {
  return (
    <EditCycleButton
      cycleSlug={cycle.slug}
      name={cycle.title}
      type={cycle.type}
      start_date={cycle.start_date}
      end_date={cycle.end_date}
      archived={cycle.archived}
    />
  )
}
