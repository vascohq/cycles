'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ClientSideSuspense } from '@liveblocks/react'
import { ArrowLeft, Check, ChevronRight, ExternalLink, Link2, Megaphone, Pencil, Sparkles, TriangleAlert } from 'lucide-react'
import {
  ProductMapRoomProvider,
  productMapInitialStorage,
  useProductMapStorage,
} from '@/product-map-room-context'
import type { Area, Frame } from '@/product-map-liveblocks.config'
import {
  POINTER_KIND_LABELS,
  renderFrame,
  renderProductMap,
  type CycleWindow,
  type FrameState,
  type LinkedShape,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'
import type { OrganizationUser } from '@/lib/users'
import {
  OrganizationUsersProvider,
  useOrganizationUsers,
} from '@/components/organization-users-context'
import { UserAvatar } from '@/components/scope-card/assignee-picker'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CyclesContext,
  FrameDetail,
  KIND_LABELS,
  OpenFrameContext,
  STATE_LABELS,
  TYPE_LABELS,
  UNMAPPED_ANCHOR,
  areaAnchor,
  areaOptions,
  useOpenFramePage,
} from '../../product-map'

/** A frame's life, left to right. The page shows where it stands on this track. */
const TRACK: FrameState[] = ['rough', 'candidate', 'in_flight', 'released', 'monitoring', 'resolved']

/**
 * The frame on a page of its own, so it has a URL somebody can share. It reads
 * the frame and never wakes it (ADR 0024). Editing stays in the frame dialog,
 * opened from here, so a field means the same thing on the map and on the page.
 */
export function FramePage({
  roomId,
  frameId,
  organizationUsers,
  cycles,
  shapes,
}: {
  roomId: string
  frameId: string
  organizationUsers: OrganizationUser[]
  cycles: CycleWindow[]
  shapes: LinkedShape[]
}) {
  return (
    <OrganizationUsersProvider organizationUsers={organizationUsers}>
      <ProductMapRoomProvider id={roomId} initialPresence={{}} initialStorage={productMapInitialStorage()}>
        <ClientSideSuspense fallback={<FramePageSkeleton />}>
          {() => <FramePageView frameId={frameId} cycles={cycles} shapes={shapes} />}
        </ClientSideSuspense>
      </ProductMapRoomProvider>
    </OrganizationUsersProvider>
  )
}

function FramePageView(props: { frameId: string; cycles: CycleWindow[]; shapes: LinkedShape[] }) {
  // Guarded reads: a room whose root predates either list must still render.
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])
  return <FrameLayout {...props} frames={frames} areas={areas} editable />
}

/**
 * The page itself, from plain data, so the e2e route can draw it from a fixture
 * with no room. `editable` mounts the frame dialog, which needs the room.
 */
export function FrameLayout({
  frameId,
  frames,
  areas,
  cycles,
  shapes,
  editable = false,
}: {
  frameId: string
  frames: Frame[]
  areas: Area[]
  cycles: CycleWindow[]
  shapes: LinkedShape[]
  editable?: boolean
}) {
  const openFrame = useOpenFramePage()
  const [editing, setEditing] = useState(false)

  const input = { areas, frames, cycles, shapes, today: getTeamToday(new Date()) }
  const pin = renderFrame(input, frameId)
  const options = areaOptions(renderProductMap(input).areas)

  useEffect(() => {
    if (pin) document.title = `${pin.problem || 'Frame'} | Cycles`
  }, [pin?.problem]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pin) return <NoFrame />

  return (
    <OpenFrameContext.Provider value={openFrame}>
      <CyclesContext.Provider value={cycles}>
        <main className="flex w-full flex-col pb-16">
          <div className="border-b bg-muted/30">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
              <Breadcrumb areaPath={areaPath(areas, pin.areaId)} onEdit={editable ? () => setEditing(true) : undefined} />
              <Header pin={pin} />
              <Track pin={pin} />
              <Brief pin={pin} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl px-6 pt-6">
            <Announcement pin={pin} onWrite={editable ? () => setEditing(true) : undefined} />
          </div>
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-6 md:grid-cols-3">
            <Framing pin={pin} />
            <Lane title={`Evidence · ${pin.reports.length}`} hint="Every time it happened">
              <Timeline pin={pin} cycles={cycles} />
            </Lane>
            <Work pin={pin} />
          </div>
        </main>
        {editing && <FrameDetail pin={pin} onClose={() => setEditing(false)} areas={options} />}
      </CyclesContext.Provider>
    </OpenFrameContext.Provider>
  )
}

type Crumb = { name: string; anchor: string }

/** The areas the frame sits in, outermost first. Each links to its section on the map. */
function areaPath(areas: Area[], areaId: string): Crumb[] {
  const path: Crumb[] = []
  const seen = new Set<string>()
  let area = areas.find((a) => a.id === areaId)
  // `seen` guards a parent loop an agent could write; the map draws one too.
  while (area && !seen.has(area.id)) {
    seen.add(area.id)
    path.unshift({ name: area.name, anchor: areaAnchor(area.id) })
    const parentId = area.parentAreaId
    area = areas.find((a) => a.id === parentId)
  }
  return path.length ? path : [{ name: 'Unmapped', anchor: UNMAPPED_ANCHOR }]
}

function useMember(id: string | null | undefined) {
  const users = useOrganizationUsers()
  return id ? users.find((u) => u.userId === id) : undefined
}

function Breadcrumb({ areaPath, onEdit }: { areaPath: Crumb[]; onEdit?: () => void }) {
  const { slug } = useParams<{ slug: string }>()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link href={`/${slug}/product-map`} className="flex shrink-0 items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Product Map
        </Link>
        {/* A chevron, not a slash: an area name can hold a slash ("Slack / Teams"). */}
        {areaPath.map((crumb) => (
          <span key={crumb.anchor} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <Link href={`/${slug}/product-map#${crumb.anchor}`} className="truncate hover:text-foreground">
              {crumb.name}
            </Link>
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href)
            setCopied(true)
          }}
          className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
        >
          <Link2 className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
    </div>
  )
}

function Header({ pin }: { pin: RenderedPin }) {
  const owner = useMember(pin.owner)
  // A frame can be attacked by more than one shape; the squads are the people on it now.
  const squads = [...new Map(pin.shapes.filter((s) => s.squad).map((s) => [s.squad!.name, s.squad!])).values()]
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl leading-tight">{pin.problem || 'Untitled frame'}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: pin.color }} />
          {KIND_LABELS[pin.kind]}
        </span>
        <span>{TYPE_LABELS[pin.type]}</span>
        <span>Appetite: {pin.appetite || 'not set'}</span>
        <span className="flex items-center gap-1.5">
          Owner:{' '}
          {owner ? (
            <>
              <UserAvatar user={owner} /> {owner.name}
            </>
          ) : pin.owner ? (
            'Former member'
          ) : (
            <span className="text-amber-600">nobody yet</span>
          )}
        </span>
        {squads.map((squad) => (
          <span key={squad.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: squad.color }} /> {squad.name}
          </span>
        ))}
        {!pin.sharp && <span className="rounded bg-muted px-1.5 text-xs">Rough</span>}
        {pin.dormant && <span className="rounded bg-muted px-1.5 text-xs">Dormant</span>}
      </p>
    </div>
  )
}

function Track({ pin }: { pin: RenderedPin }) {
  const at = TRACK.indexOf(pin.state)
  const current = pin.shapes.find((s) => s.stage !== 'done')
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Frame state">
      {TRACK.map((state, i) => (
        <li key={state} className="flex flex-col gap-1.5" aria-current={i === at ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full ${i < at ? 'bg-foreground/70' : i === at ? 'bg-fuchsia-600' : 'bg-border'}`} />
          <span className={`flex items-center gap-1 text-xs ${i === at ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {i < at && <Check className="h-3 w-3" />}
            {STATE_LABELS[state]}
            {i === at && state === 'in_flight' && current && ` · ${current.cycleTitle}`}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Nobody asks Paulo live from the page (ADR 0029). The page shows the last
 * brief he left, with its date. To get a fresh one, a person opens a new Claude
 * chat with /paulo and this frame already typed.
 */
export function askPauloUrl(frameId: string, problem: string): string {
  const prompt = `/paulo where are we on frame ${frameId} (“${problem}”)? Read its reports, pointers and shapes, then leave a fresh brief on the frame with map_write_brief. If it has no release announcement yet, draft one with map_upsert_frame.`
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}

function Brief({ pin }: { pin: RenderedPin }) {
  const brief = pin.brief
  const writer = useMember(brief?.written_by)
  const nextOwner = useMember(brief?.next_step_owner)
  const ask = (
    <a
      href={askPauloUrl(pin.frameId, pin.problem)}
      target="_blank"
      rel="noreferrer"
      className="flex shrink-0 items-center gap-1 self-start rounded-md border px-2 py-1 text-xs hover:bg-muted"
    >
      <Sparkles className="h-3.5 w-3.5 text-fuchsia-600" /> {brief ? 'Ask Paulo again' : 'Ask Paulo'}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  )

  if (!brief) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
        <Sparkles className="h-5 w-5 shrink-0" />
        <p className="flex-1">No brief yet. Ask Paulo to read the frame and leave one: where it stands and the next step.</p>
        {ask}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-background p-4 shadow-sm ring-1 ring-border sm:flex-row">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-100">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">
          {writer?.name ?? capitalize(brief.written_by)} left this on {formatDate(brief.written_on)}
        </p>
        <p className="font-medium">{brief.headline}</p>
        {brief.where_we_are && <p className="mt-1 text-sm text-muted-foreground">{brief.where_we_are}</p>}
        <p className="mt-2 text-sm">
          <span className="font-semibold">To move on:</span> {brief.next_step}
          {nextOwner && <span className="text-muted-foreground"> ({nextOwner.name})</span>}
        </p>
        {brief.watch && (
          <p className="mt-2 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {brief.watch}
          </p>
        )}
      </div>
      {ask}
    </div>
  )
}

/** Shipped, so the announcement is no longer a draft. */
const SHIPPED: FrameState[] = ['released', 'monitoring', 'resolved']

/**
 * The release note customers would read once the problem is solved. Written
 * first, as a draft, so the frame says in the customer's words what solving it
 * means before anybody builds anything.
 */
function Announcement({ pin, onWrite }: { pin: RenderedPin; onWrite?: () => void }) {
  if (!pin.announcement) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Megaphone className="h-5 w-5 shrink-0" />
        <p className="flex-1">
          No release announcement yet. Write the note you would send customers once this is
          solved. It shows what the fix means for them.
        </p>
        {onWrite && (
          <button type="button" onClick={onWrite} className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted">
            Write it
          </button>
        )}
      </div>
    )
  }
  const draft = !SHIPPED.includes(pin.state)
  return (
    <section className="rounded-xl border bg-background p-5" aria-label="Release announcement">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Megaphone className="h-3.5 w-3.5" /> Release announcement
        {draft && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">Draft</span>}
      </div>
      <p className="max-w-3xl whitespace-pre-line text-base leading-relaxed">{pin.announcement}</p>
    </section>
  )
}

function Framing({ pin }: { pin: RenderedPin }) {
  const openFrame = useOpenFramePage()
  return (
    <Lane title="Framing" hint="What hurts, and what changes">
      {pin.businessCase ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">{pin.businessCase}</p>
      ) : (
        <Empty>No business case yet.</Empty>
      )}
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcomes</p>
      {pin.outcomes.length ? (
        pin.outcomes.map((o) => <Card key={o.id}>{o.text}</Card>)
      ) : (
        <Empty>None yet, so it cannot be bet on.</Empty>
      )}
      {pin.candidateStatement && <p className="text-sm italic text-muted-foreground">{pin.candidateStatement}</p>}
      {pin.originChain.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Surfaced while monitoring{' '}
          <button type="button" onClick={() => openFrame(pin.originChain[0].frameId)} className="text-foreground underline">
            {pin.originChain[0].problem}
          </button>
        </p>
      )}
    </Lane>
  )
}

type Event = { date: string; label: string; text: string; tone: 'internal' | 'customer' | 'work' }

function Timeline({ pin, cycles }: { pin: RenderedPin; cycles: CycleWindow[] }) {
  const users = useOrganizationUsers()
  const name = (id: string) => users.find((u) => u.userId === id)?.name ?? id
  const events: Event[] = [
    ...pin.reports.map((r) => ({
      date: r.date,
      label: `${name(r.capturer)} ${r.source === 'customer' ? `reported for ${r.customer || 'a customer'}` : 'reported'}`,
      text: r.text,
      tone: r.source,
    })),
    // A shape stores no bet date, so the timeline marks the cycle it started in.
    ...pin.shapes.flatMap((s) => {
      const start = cycles.find((c) => c.slug === s.cycleSlug)?.start_date
      return start ? [{ date: start, label: `${s.cycleTitle} started`, text: `“${s.title}”${s.squad ? ` with ${s.squad.name}` : ''}`, tone: 'work' as const }] : []
    }),
  ].sort((a, b) => b.date.localeCompare(a.date))

  if (!events.length) return <Empty>No reports yet.</Empty>
  return (
    <ol className="relative ml-1.5 flex flex-col gap-4 border-l pl-5">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background ${
              e.tone === 'work' ? 'bg-foreground' : e.tone === 'customer' ? 'bg-amber-500' : 'bg-muted-foreground/40'
            }`}
          />
          <p className="text-xs text-muted-foreground">
            {formatDate(e.date)} · {e.label}
          </p>
          <p className="text-sm">{e.text}</p>
        </li>
      ))}
    </ol>
  )
}

function Work({ pin }: { pin: RenderedPin }) {
  const { slug } = useParams<{ slug: string }>()
  // The pitch lives on the shape (its Notion link). A frame can also carry a
  // shaped writeup pointer, for a pitch written before any shape existed.
  const pitchUrl =
    pin.shapes.find((s) => s.notionUrl)?.notionUrl ??
    pin.pointers.find((p) => p.kind === 'shaped_doc')?.url
  const pointers = pin.pointers.filter((p) => p.kind !== 'shaped_doc' || p.url !== pitchUrl)
  const gaps = pin.gaps.filter((g) => g !== 'shaped_doc' || !pitchUrl)

  return (
    <Lane title="Work & pointers" hint="Where the artifacts live">
      {pin.shapes.length ? (
        pin.shapes.map((s) => (
          <Link
            key={s.shapeId}
            href={`/${slug}/cycles/${s.cycleSlug}/${s.shapeId}`}
            className="rounded-lg border bg-background p-3 text-sm hover:bg-muted"
          >
            <p className="font-medium">{s.title}</p>
            <p className="text-xs text-muted-foreground">
              {s.cycleTitle} · <span className="capitalize">{s.stage}</span>
              {s.squad && ` · ${s.squad.name}`}
            </p>
          </Link>
        ))
      ) : (
        <Card>
          <span className="text-muted-foreground">No shape yet. Not in any cycle.</span>
        </Card>
      )}

      {pitchUrl ? (
        <a href={pitchUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-lg border bg-background p-3 text-sm hover:bg-muted">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold">N</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Pitch</span>
            <span className="block truncate font-medium">Open in Notion</span>
          </span>
          <ExternalLink className="h-3.5 w-3.5 opacity-40 group-hover:opacity-80" />
        </a>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed text-sm font-bold">N</span>
          No pitch yet. Link the Notion pitch on the shape once shaping starts.
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {pointers.map((p, i) => (
          <li key={i}>
            <a href={p.url} target="_blank" rel="noreferrer" className="group flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
              <span className="mt-0.5 w-24 shrink-0 text-xs text-muted-foreground">{POINTER_KIND_LABELS[p.kind]}</span>
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
            </a>
          </li>
        ))}
        {gaps.map((g) => (
          <li key={g} className="flex items-center gap-2 rounded-md border border-dashed p-1.5 text-sm text-muted-foreground">
            <span className="w-24 shrink-0 text-xs">{POINTER_KIND_LABELS[g]}</span>
            <span>Missing. The {TYPE_LABELS[pin.type].toLowerCase()} playbook expects one.</span>
          </li>
        ))}
      </ul>
    </Lane>
  )
}

function Lane({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-background p-3 text-sm">{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function NoFrame() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
      <p className="font-display text-xl">No frame here</p>
      <p className="text-sm text-muted-foreground">It was deleted, or the link is wrong.</p>
      <Link href={`/${slug}/product-map`} className="text-sm underline">
        Back to the Product Map
      </Link>
    </main>
  )
}

/** The page's own layout in grey, so nothing jumps when the room arrives. */
function FramePageSkeleton() {
  return (
    <main className="flex w-full flex-col pb-16" aria-busy="true">
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          </div>
          <div className="flex max-w-3xl flex-col gap-3">
            <Skeleton className="h-9 w-4/5" />
            <div className="flex flex-wrap gap-3">
              {['w-24', 'w-12', 'w-32', 'w-36', 'w-28'].map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w}`} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-1.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 rounded-xl bg-background p-4 ring-1 ring-border">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-28 shrink-0" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <div className="flex flex-col gap-2 rounded-xl border p-5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, lane) => (
          <div key={lane} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mb-1 h-3 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
