'use client'

import { createContext, useContext, useState } from 'react'
import { ClientSideSuspense } from '@liveblocks/react'
import { LiveObject } from '@liveblocks/client'
import { useAuth } from '@clerk/nextjs'
import { nanoid } from 'nanoid'
import {
  ProductMapRoomProvider,
  useProductMapStorage,
  useProductMapMutation,
  productMapInitialStorage,
} from '@/product-map-room-context'
import type { Area, Frame, FrameKind, FrameType } from '@/product-map-liveblocks.config'
import {
  AREA_GAP,
  DEFAULT_KIND,
  FRAME_KINDS,
  FRAME_TYPES,
  renderProductMap,
  type FrameState,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'
import type { OrganizationUser } from '@/lib/users'
import {
  OrganizationUsersProvider,
  useOrganizationUsers,
} from '@/components/organization-users-context'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Labels are the only place these vocabularies get prose. The stored values
// stay machine-readable, because MCP callers filter on them.
const KIND_LABELS: Record<FrameKind, string> = {
  brand_burn: 'Brand burn',
  pain_point: 'Pain point',
  unlock_win: 'Win to unlock',
}

const TYPE_LABELS: Record<FrameType, string> = {
  bug: 'Bug',
  idea: 'Idea',
  request: 'Request',
  security: 'Security',
  irritant: 'Irritant',
}

const STATE_LABELS: Record<FrameState, string> = {
  rough: 'Rough',
  candidate: 'Candidate',
  in_flight: 'In flight',
  released: 'Released',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

/** The Select value that stands for "no area". Empty string is not selectable. */
const UNMAPPED = '__unmapped__'
/** The Select value that stands for "nobody holds this frame". */
const NOBODY = '__nobody__'

/**
 * A pin sits three components deep inside the land, and opening its frame is
 * none of that land's business — so the opener travels by context instead of
 * threading through every region (the repo rule on cross-cutting concerns).
 */
const OpenFrameContext = createContext<(frameId: string) => void>(() => {})

export function ProductMap({
  roomId,
  organizationUsers,
}: {
  roomId: string
  organizationUsers: OrganizationUser[]
}) {
  return (
    <OrganizationUsersProvider organizationUsers={organizationUsers}>
      <ProductMapRoomProvider
        id={roomId}
        initialPresence={{}}
        initialStorage={productMapInitialStorage()}
      >
        <ClientSideSuspense fallback={<ProductMapSkeleton />}>
          {() => <ProductMapView />}
        </ClientSideSuspense>
      </ProductMapRoomProvider>
    </OrganizationUsersProvider>
  )
}

function ProductMapView() {
  // Guarded reads: `initialStorage` only seeds a brand-new room, so a room whose
  // root predates either list must still render, not throw.
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])
  const [openFrameId, setOpenFrameId] = useState<string | null>(null)

  // Today is a parameter of the engine, never a clock inside it. Resolved here
  // in the team timezone, the same as every other date-derived surface.
  const model = renderProductMap({ areas, frames, today: getTeamToday(new Date()) })
  const options = areaOptions(model.areas)
  // Opening a frame reads it and nothing more. It never wakes it (ADR 0024).
  const open = model.pins.find((pin) => pin.frameId === openFrameId) ?? null

  return (
    <OpenFrameContext.Provider value={setOpenFrameId}>
      <Shell>
        <CaptureForm areas={options} areaOwners={areaOwners(model.areas)} />
        <AreaForm areaCount={areas.length} />
        {model.pins.length === 0 && model.areas.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
            <p className="font-display text-lg">Nothing on the Product Map yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              An area is a region of your product. A frame records one problem in
              it. The first of either appears here.
            </p>
          </div>
        )}
        {model.areas.length > 0 && <AreaField areas={model.areas} options={options} />}
        <UnmappedGroup pins={model.unmapped} options={options} />
        <FrameDetail pin={open} onClose={() => setOpenFrameId(null)} />
      </Shell>
    </OpenFrameContext.Provider>
  )
}

/** Area id → the owner the area suggests for a new frame filed there. */
function areaOwners(areas: RenderedArea[]): Record<string, string> {
  const owners: Record<string, string> = {}
  for (const area of areas) {
    if (area.owner) owners[area.areaId] = area.owner
    Object.assign(owners, areaOwners(area.children))
  }
  return owners
}

/** One flat, indented list of every area, for the "file this frame" pickers. */
type AreaOption = { id: string; label: string }

function areaOptions(areas: RenderedArea[], depth = 0): AreaOption[] {
  return areas.flatMap((area) => [
    { id: area.areaId, label: `${'— '.repeat(depth)}${area.name}` },
    ...areaOptions(area.children, depth + 1),
  ])
}

/**
 * The land. Every region is placed from the shape the engine generated, so no
 * geometry is stored and an agent that cannot draw still gets a drawn area.
 */
function AreaField({ areas, options }: { areas: RenderedArea[]; options: AreaOption[] }) {
  const height = Math.max(0, ...areas.map((a) => a.shape.y + a.shape.height))
  const width = Math.max(0, ...areas.map((a) => a.shape.x + a.shape.width))

  return (
    <div
      className="relative overflow-x-auto rounded-xl border border-dashed p-4"
      style={{ minHeight: height + AREA_GAP }}
    >
      <div className="relative" style={{ height, width }}>
        {areas.map((area) => (
          <AreaRegion key={area.areaId} area={area} options={options} />
        ))}
      </div>
    </div>
  )
}

// An area is never colored by the health of its frames — that would make the
// individual pins unreadable. Every region gets the same neutral ground.
function AreaRegion({ area, options }: { area: RenderedArea; options: AreaOption[] }) {
  return (
    <section
      aria-label={area.name}
      className="absolute overflow-auto rounded-xl border bg-muted/30 p-3"
      style={{
        left: area.shape.x,
        top: area.shape.y,
        width: area.shape.width,
        height: area.shape.height,
      }}
    >
      <h2 className="mb-2 font-display text-sm">{area.name}</h2>
      <ul className="flex flex-col gap-1.5">
        {area.pins.map((pin) => (
          <PinDot key={pin.frameId} pin={pin} options={options} />
        ))}
      </ul>
      {area.children.length > 0 && (
        <div className="relative mt-2" style={{ height: subAreaHeight(area) }}>
          {area.children.map((child) => (
            <AreaRegion key={child.areaId} area={child} options={options} />
          ))}
        </div>
      )}
    </section>
  )
}

function subAreaHeight(area: RenderedArea): number {
  return Math.max(0, ...area.children.map((c) => c.shape.y + c.shape.height))
}

function UnmappedGroup({ pins, options }: { pins: RenderedPin[]; options: AreaOption[] }) {
  if (pins.length === 0) return null
  return (
    <section aria-label="Unmapped" className="mt-6">
      <h2 className="mb-2 font-display text-sm">
        Unmapped <span className="text-muted-foreground">({pins.length})</span>
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        These frames belong to no area yet. Leaving one here is always valid.
      </p>
      <ul className="flex flex-col gap-1.5">
        {pins.map((pin) => (
          <PinDot key={pin.frameId} pin={pin} options={options} />
        ))}
      </ul>
    </section>
  )
}

function PinDot({ pin, options }: { pin: RenderedPin; options: AreaOption[] }) {
  const openFrame = useContext(OpenFrameContext)
  // Filing a frame is the one edit a pin carries. Moving it out is the same
  // write with the area cleared, so nothing needs a second control.
  const fileFrame = useProductMapMutation(
    ({ storage }, frameId: string, areaId: string) => {
      const frame = storage
        .get('frames')
        .find((f) => f.get('id') === frameId)
      if (!frame) return
      if (areaId) frame.set('areaId', areaId)
      else frame.delete('areaId')
    },
    []
  )

  return (
    <li className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
      {/* A rough pin is drawn hollow, so a raw capture never reads as agreed
          work. This modulates the color channel (Kind) rather than adding a
          fifth channel, which is the map's legibility ceiling (ADR 0025). */}
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full border-2"
        style={{
          borderColor: pin.color,
          backgroundColor: pin.sharp ? pin.color : 'transparent',
        }}
      />
      <button
        type="button"
        className="truncate text-left hover:underline"
        onClick={() => openFrame(pin.frameId)}
      >
        {pin.problem}
      </button>
      <span className="shrink-0 text-xs text-muted-foreground">
        {KIND_LABELS[pin.kind]} · {TYPE_LABELS[pin.type]} · {STATE_LABELS[pin.state]}
      </span>
      {options.length > 0 && (
        <Select
          value={pin.areaId || UNMAPPED}
          onValueChange={(v) => fileFrame(pin.frameId, v === UNMAPPED ? '' : v)}
        >
          <SelectTrigger className="ml-auto h-7 w-36 shrink-0" aria-label="Area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNMAPPED}>Unmapped</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </li>
  )
}

/**
 * The frame detail. This is where a shaper writes the problem, the appetite and
 * the business case, so the betting table can judge the frame. It holds NO
 * outcome: the map stays about problems, and shaping stays about solutions.
 *
 * Every field writes straight to storage. There is no save button, because a
 * half-typed frame is a normal state here — a frame sits rough until somebody
 * sharpens it.
 */
function FrameDetail({ pin, onClose }: { pin: RenderedPin | null; onClose: () => void }) {
  const users = useOrganizationUsers()

  const editFrame = useProductMapMutation(
    ({ storage }, frameId: string, field: EditableField, value: string) => {
      const frame = storage.get('frames').find((f) => f.get('id') === frameId)
      if (!frame) return
      // '' clears an optional field: the key goes away rather than sitting there
      // as an empty string nobody can tell from "unset".
      if (field === 'owner' && value === '') frame.delete('owner')
      else frame.set(field, value as never)
    },
    []
  )

  if (!pin) return null
  const set = (field: EditableField) => (value: string) =>
    editFrame(pin.frameId, field, value)

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      {/* key: a fresh frame gets fresh local field state, so no draft leaks
          from the frame that was open before it. */}
      <SheetContent key={pin.frameId} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {pin.sharp ? 'Sharp frame' : 'Rough frame'}
          </SheetTitle>
          <SheetDescription>
            {STATE_LABELS[pin.state]}
            {pin.sharp
              ? ''
              : ' — a frame is sharp once it has both a problem and an appetite.'}
          </SheetDescription>
        </SheetHeader>

        <Field label="Problem" hint="One line saying what hurts.">
          <DraftTextarea value={pin.problem} rows={2} onCommit={set('problem')} />
        </Field>

        <Field label="Appetite" hint="The time the business will spend, e.g. 6 weeks.">
          <DraftInput value={pin.appetite} onCommit={set('appetite')} />
        </Field>

        {pin.candidateStatement && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm italic">
            {pin.candidateStatement}
          </p>
        )}

        <Field
          label="Business case"
          hint="Who is affected, what it is worth, why now."
        >
          <DraftTextarea value={pin.businessCase} rows={4} onCommit={set('business_case')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind" hint="How much it hurts.">
            <Select value={pin.kind} onValueChange={set('kind')}>
              <SelectTrigger aria-label="Kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRAME_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type" hint="Selects the playbook.">
            <Select value={pin.type} onValueChange={set('type')}>
              <SelectTrigger aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRAME_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Frame owner"
          hint="The one person who cares that this gets addressed."
        >
          <Select
            value={pin.owner ?? NOBODY}
            onValueChange={(v) => set('owner')(v === NOBODY ? '' : v)}
          >
            <SelectTrigger aria-label="Frame owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>Nobody yet</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.userId} value={u.userId}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </SheetContent>
    </Sheet>
  )
}

type EditableField = 'problem' | 'appetite' | 'business_case' | 'kind' | 'type' | 'owner'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Typed text commits on blur, not on every keystroke: a Liveblocks write per
// character would fight the cursor of anyone else in the room.
function DraftInput({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  )
}

function DraftTextarea({
  value,
  rows,
  onCommit,
}: {
  value: string
  rows: number
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <Textarea
      rows={rows}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  )
}

/**
 * Capture costs one line and a Type. Type is required because it selects the
 * playbook (ADR 0025); everything else can wait for somebody to sharpen the
 * frame. Kind starts at pain_point so nobody has to grade a severity at 4pm on
 * a Friday, and the area can stay Unmapped.
 */
function CaptureForm({
  areas,
  areaOwners,
}: {
  areas: AreaOption[]
  areaOwners: Record<string, string>
}) {
  const [problem, setProblem] = useState('')
  const [type, setType] = useState<FrameType>('bug')
  const [kind, setKind] = useState<FrameKind>(DEFAULT_KIND)
  const [areaId, setAreaId] = useState(UNMAPPED)
  const { userId } = useAuth()

  const captureFrame = useProductMapMutation(({ storage }, frame: Frame) => {
    storage.get('frames').push(new LiveObject(frame))
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = problem.trim()
    if (!text) return
    // Every frame leaves capture owned. The area's owner is the suggestion, and
    // it is only a suggestion — the capturer changes it in the frame detail. An
    // Unmapped frame falls back to the capturer, because somebody must care.
    const owner = areaOwners[areaId] ?? userId ?? ''
    captureFrame({
      id: nanoid(),
      kind,
      type,
      problem: text,
      appetite: '',
      business_case: '',
      ...(areaId === UNMAPPED ? {} : { areaId }),
      ...(owner ? { owner } : {}),
      reports: [],
      pointers: [],
      // A frame is born awake. Its clock starts on the day it was captured.
      last_woken: getTeamToday(new Date()),
      resolved: false,
    })
    setProblem('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-3 flex flex-wrap items-center gap-2">
      <Input
        className="min-w-64 flex-1"
        placeholder="What hurts?"
        aria-label="Problem"
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
      />
      <Select value={type} onValueChange={(v) => setType(v as FrameType)}>
        <SelectTrigger className="w-36" aria-label="Type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FRAME_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={kind} onValueChange={(v) => setKind(v as FrameKind)}>
        <SelectTrigger className="w-40" aria-label="Kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FRAME_KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {KIND_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {areas.length > 0 && (
        <Select value={areaId} onValueChange={setAreaId}>
          <SelectTrigger className="w-40" aria-label="Area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNMAPPED}>Unmapped</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button type="submit" disabled={!problem.trim()}>
        Capture
      </Button>
    </form>
  )
}

/**
 * An area needs a name and nothing else. Its position is the next free grid
 * slot, and the engine turns that into the shape — the same deal an agent gets
 * through `map_upsert_area`.
 */
function AreaForm({ areaCount }: { areaCount: number }) {
  const [name, setName] = useState('')

  const addArea = useProductMapMutation(({ storage }, area: Area) => {
    storage.get('areas').push(new LiveObject(area))
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = name.trim()
    if (!text) return
    // Three across, then wrap. Mirrors the writer's slot rule.
    addArea({ id: nanoid(), name: text, x: areaCount % 3, y: Math.floor(areaCount / 3) })
    setName('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 flex flex-wrap items-center gap-2">
      <Input
        className="min-w-48 max-w-64"
        placeholder="Add an area, e.g. Integrations"
        aria-label="Area name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="outline" disabled={!name.trim()}>
        Add area
      </Button>
    </form>
  )
}

function ProductMapSkeleton() {
  return (
    <Shell>
      <div className="h-48 animate-pulse rounded-xl border border-dashed bg-muted/40" />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Product Map</h1>
      {children}
    </main>
  )
}
