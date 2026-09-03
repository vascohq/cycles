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
import type {
  Area,
  Frame,
  FrameKind,
  FramePointer,
  FrameReport,
  FrameType,
  PointerKind,
} from '@/product-map-liveblocks.config'
import {
  DEFAULT_KIND,
  KIND_COLORS,
  DEFAULT_LENS,
  FRAME_KINDS,
  FRAME_TYPES,
  POINTER_KINDS,
  POINTER_KIND_LABELS,
  renderProductMap,
  type CycleWindow,
  type FrameState,
  type LinkedShape,
  type HeatLens,
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { MapCanvas } from '@/components/product-map/map-canvas'
import { getTeamToday } from '@/lib/team-time'
import type { OrganizationUser } from '@/lib/users'
import { betOnFrame } from './actions'
import {
  OrganizationUsersProvider,
  useOrganizationUsers,
} from '@/components/organization-users-context'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

const SOURCE_LABELS: Record<FrameReport['source'], string> = {
  internal: 'Internal',
  customer: 'Customer',
}

const STATE_LABELS: Record<FrameState, string> = {
  rough: 'Rough',
  candidate: 'Candidate',
  in_flight: 'In flight',
  released: 'Released',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

/**
 * A pill: a compact, rounded control that reads as a tag rather than a form
 * field. Same as the new-card modal on the Scope Map, so the two surfaces feel
 * like one app.
 */
const PILL =
  'inline-flex h-auto w-auto items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:ring-0 focus:ring-offset-0'

/**
 * A pill that edits. Capture and the frame form use the same one, so a frame is
 * read and written the same way and nothing has to be learned twice.
 */
function PillSelect({
  value,
  onChange,
  label,
  options,
  dot,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: { value: string; label: string }[]
  dot?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={PILL} aria-label={label}>
        {dot && (
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: dot }} />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** One wording, so the field reads the same whether a frame is being made or read. */
const WHY_LABEL = 'Why does this matter to Vasco?'

const KIND_OPTIONS = FRAME_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))
const TYPE_OPTIONS = FRAME_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))

/** A borderless title that reads as a heading, not an input. */
const TITLE_INPUT =
  'w-full resize-none bg-transparent text-lg font-medium leading-snug outline-none placeholder:text-muted-foreground/40 focus:outline-none'

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

/** The cycles a frame can be bet into. Read once, at the page boundary. */
const CyclesContext = createContext<CycleWindow[]>([])

/**
 * `full` is the Product Map's own page: the land, plus capture, plus every list
 * that reaches a frame the land does not show.
 *
 * `canvas` is the land and nothing else, for embedding somewhere the map is not
 * the subject — the cycles home page. Clicking a pin still opens its frame,
 * because a map you cannot read from is decoration.
 */
export type ProductMapVariant = 'full' | 'canvas'

export function ProductMap({
  roomId,
  organizationUsers,
  cycles,
  shapes,
  variant = 'full',
  heading,
  action,
}: {
  roomId: string
  organizationUsers: OrganizationUser[]
  cycles: CycleWindow[]
  shapes: LinkedShape[]
  variant?: ProductMapVariant
  /** Left of the canvas's heading row. Only read by the `canvas` variant. */
  heading?: React.ReactNode
  /** Right of it, before Capture. Only read by the `canvas` variant. */
  action?: React.ReactNode
}) {
  return (
    <OrganizationUsersProvider organizationUsers={organizationUsers}>
      <ProductMapRoomProvider
        id={roomId}
        initialPresence={{}}
        initialStorage={productMapInitialStorage()}
      >
        <ClientSideSuspense fallback={<ProductMapSkeleton />}>
          {() => (
            <ProductMapView
              cycles={cycles}
              shapes={shapes}
              variant={variant}
              heading={heading}
              action={action}
            />
          )}
        </ClientSideSuspense>
      </ProductMapRoomProvider>
    </OrganizationUsersProvider>
  )
}

function ProductMapView({
  cycles,
  shapes,
  variant,
  heading,
  action,
}: {
  cycles: CycleWindow[]
  shapes: LinkedShape[]
  variant: ProductMapVariant
  heading?: React.ReactNode
  action?: React.ReactNode
}) {
  // Guarded reads: `initialStorage` only seeds a brand-new room, so a room whose
  // root predates either list must still render, not throw.
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])
  const [openFrameId, setOpenFrameId] = useState<string | null>(null)
  // No control on the page for this. The engine still computes every lens, and
  // MCP callers still filter by one, so the switch can come back without a
  // change to the model.
  const lens: HeatLens = DEFAULT_LENS

  // Today is a parameter of the engine, never a clock inside it. Resolved here
  // in the team timezone, the same as every other date-derived surface.
  const model = renderProductMap({
    areas,
    frames,
    lens,
    cycles,
    shapes,
    today: getTeamToday(new Date()),
  })
  const options = areaOptions(model.areas)
  // Opening a frame reads it and nothing more. It never wakes it (ADR 0024).
  // Searched across every rendered frame, not only the ones on the Product Map: an
  // origin link can point at a frame that is asleep or already resolved.
  const open =
    [...model.pins, ...model.dormantReview, ...model.resolved].find(
      (pin) => pin.frameId === openFrameId
    ) ?? null

  // The land only. No capture, and none of the lists that reach a frame the
  // land does not show — those belong to the Product Map's own page, not to a
  // page where the map is a view onto somewhere else.
  if (variant === 'canvas') {
    return (
      <OpenFrameContext.Provider value={setOpenFrameId}>
        <CyclesContext.Provider value={cycles}>
          {/* The heading row lives in here, not on the host page: Capture needs
              the room, and the room provider stops at this component. */}
          <div className="flex items-baseline justify-between gap-3">
            {heading}
            <div className="flex items-center gap-3">
              {action}
              <CaptureMenu areas={options} areaOwners={areaOwners(model.areas)} />
            </div>
          </div>
          {model.areas.length > 0 ? (
            <MapCanvas areas={model.areas} onOpenFrame={setOpenFrameId} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No land yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                The map is drawn by an agent. Describe your product to Claude
                and it draws the land through the Cycles MCP server.
              </p>
              <div className="w-full max-w-lg text-left">
                <AskClaude drawTheMap />
              </div>
            </div>
          )}
          <FrameDetail
            pin={open}
            onClose={() => setOpenFrameId(null)}
            areas={options}
          />
        </CyclesContext.Provider>
      </OpenFrameContext.Provider>
    )
  }

  return (
    <OpenFrameContext.Provider value={setOpenFrameId}>
      <CyclesContext.Provider value={cycles}>
        <Shell action={<CaptureMenu areas={options} areaOwners={areaOwners(model.areas)} />}>
          {model.pins.length === 0 && model.areas.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
              <p className="font-display text-lg">No land yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                The map is drawn by an agent. Describe your product to Claude
                and it draws the land through the Cycles MCP server: the areas,
                the islands they sit in, and the coastline round them.
              </p>
              <div className="mt-1 w-full max-w-lg text-left">
                <AskClaude drawTheMap />
              </div>
            </div>
          )}
          {model.areas.length > 0 && (
            <>
              <MapCanvas areas={model.areas} onOpenFrame={setOpenFrameId} />
              <AreaList areas={model.areas} options={options} />
            </>
          )}
          <UnmappedGroup
            pins={model.unmapped}
            resolved={model.unmappedResolved}
            options={options}
          />
          <DormantReview pins={model.dormantReview} options={options} />
          <FrameDetail pin={open} onClose={() => setOpenFrameId(null)} areas={options} />
        </Shell>
      </CyclesContext.Provider>
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
 * Every area as real DOM: its frames, and what its team resolved.
 *
 * This is the keyboard and screen-reader surface for the land. A pin on the
 * canvas is focusable, but Chrome does not expose an SVG group to the
 * accessibility tree at all, so the map alone would leave a mapped frame
 * unreachable — and it is also where each area's resolved frames live, off the
 * land, because a resolved pin would lie about where the product hurts.
 */
function AreaList({ areas, options }: { areas: RenderedArea[]; options: AreaOption[] }) {
  const flat = flattenAreas(areas).filter(
    ({ area }) => area.pins.length > 0 || area.resolved.length > 0
  )
  if (flat.length === 0) return null

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-muted-foreground">
        All frames by area
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {flat.map(({ area, depth }) => (
          <section key={area.areaId} aria-label={area.name} style={{ marginLeft: depth * 16 }}>
            <h2 className="mb-1.5 font-display text-sm">{area.name}</h2>
            {area.pins.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {area.pins.map((pin) => (
                  <PinDot key={pin.frameId} pin={pin} options={options} />
                ))}
              </ul>
            )}
            <ResolvedList pins={area.resolved} />
          </section>
        ))}
      </div>
    </details>
  )
}

function flattenAreas(
  areas: RenderedArea[],
  depth = 0
): { area: RenderedArea; depth: number }[] {
  return areas.flatMap((area) => [
    { area, depth },
    ...flattenAreas(area.children, depth + 1),
  ])
}

/**
 * The frames this area's team resolved, with the shapes that resolved them. Off
 * the Product Map and still on record: the Product Map must never lie about what we know.
 */
function ResolvedList({ pins }: { pins: RenderedPin[] }) {
  if (pins.length === 0) return null
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Resolved ({pins.length})
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {pins.map((pin) => (
          <li key={pin.frameId} className="text-xs">
            <span className="line-through">{pin.problem}</span>
            {pin.shapes.length > 0 && (
              <span className="text-muted-foreground">
                {' '}
                — {pin.shapes.map((s) => `${s.title} (${s.cycleTitle})`).join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

function UnmappedGroup({
  pins,
  resolved,
  options,
}: {
  pins: RenderedPin[]
  resolved: RenderedPin[]
  options: AreaOption[]
}) {
  if (pins.length === 0 && resolved.length === 0) return null
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
      <ResolvedList pins={resolved} />
    </section>
  )
}

/**
 * The sweep's review queue, shown only in cooldown and capped. It exists for the
 * one case dormancy cannot cover on its own: a frame that came up at the betting
 * table and that nobody's transcript turned into a wake.
 *
 * This is NOT a browsable list of dormant frames. Anything past the cap is
 * reached with a filtered `map_list_frames` query, and that friction is the
 * feature (ADR 0024).
 */
function DormantReview({ pins, options }: { pins: RenderedPin[]; options: AreaOption[] }) {
  if (pins.length === 0) return null
  return (
    <section aria-label="Went to sleep" className="mt-6">
      <h2 className="mb-2 font-display text-sm">
        Went to sleep <span className="text-muted-foreground">({pins.length})</span>
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Nobody has mentioned these for two cycles, so they have left the Product Map. They
        keep every field and every report. Say it still hurts to bring one back.
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
  const wake = useWakeFrame()
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
    <li
      // Opacity is the third pin channel: a pin fades as its clock runs, so a
      // stale map looks stale. Reading it changes nothing — browsing the Product Map
      // wakes nothing, or the decay would die (ADR 0024).
      style={{ opacity: pin.opacity }}
      className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm"
    >
      {/* All four pin channels, and no more (ADR 0025): color is the Kind, size
          is the report count under the lens, opacity (on the row) is freshness,
          and the ring is engagement. A rough pin draws hollow, which modulates
          the color channel rather than adding a fifth one. */}
      <span
        aria-hidden
        className="shrink-0 rounded-full border-2"
        style={{
          width: pin.size,
          height: pin.size,
          borderColor: pin.color,
          backgroundColor: pin.sharp ? pin.color : 'transparent',
          ...outlineStyle(pin.outline),
        }}
      />
      <button
        type="button"
        className="truncate text-left hover:underline"
        onClick={() => openFrame(pin.frameId)}
      >
        {pin.problem}
      </button>
      {/* Investment is a mark and never a number: sunk cost must not read as
          priority (ADR 0024). */}
      {pin.worked && (
        <span
          className="shrink-0 text-xs text-muted-foreground"
          title="We have bet on this before"
        >
          ✳
        </span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">
        {KIND_LABELS[pin.kind]} · {TYPE_LABELS[pin.type]} · {STATE_LABELS[pin.state]}
        {pin.reportCount > 0 && ` · ${pin.reportCount} reported`}
      </span>
      <StillHurtsButton onWake={() => wake(pin.frameId)} />
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
 * The engagement ring, the fourth pin channel. Dashed means a linked shape is
 * being shaped, solid means one is running in the cycle happening now, and
 * nothing means nobody is on it.
 */
function outlineStyle(outline: RenderedPin['outline']): React.CSSProperties {
  if (outline === 'none') return {}
  return {
    outline: `2px ${outline === 'solid' ? 'solid' : 'dashed'} currentColor`,
    outlineOffset: 2,
  }
}

/**
 * "Still hurts" — the third and simplest of the three things that wake a frame.
 * It writes the freshness clock and nothing else, so somebody keeps a frame
 * alive without having to write a new report.
 */
function useWakeFrame() {
  return useProductMapMutation(({ storage }, frameId: string) => {
    const frame = storage.get('frames').find((f) => f.get('id') === frameId)
    if (!frame) return
    frame.set('last_woken', getTeamToday(new Date()))
  }, [])
}

function StillHurtsButton({ onWake }: { onWake: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-7 shrink-0 px-2 text-xs"
      onClick={onWake}
      title="Reset this frame's freshness clock"
    >
      Still hurts
    </Button>
  )
}

/**
 * The heat lens. It changes which reports count towards pin size, and nothing
 * else — a frame keeps one freshness clock whatever the lens says. Comparing
 * the internal lens with the customer lens is how a team finds pain it is
 * ignoring.
 */
function FrameDetail({
  pin,
  onClose,
  areas,
}: {
  pin: RenderedPin | null
  onClose: () => void
  areas: AreaOption[]
}) {
  const users = useOrganizationUsers()

  const editFrame = useProductMapMutation(
    ({ storage }, frameId: string, field: EditableField, value: string) => {
      const frame = storage.get('frames').find((f) => f.get('id') === frameId)
      if (!frame) return
      // '' clears an optional field: the key goes away rather than sitting there
      // as an empty string nobody can tell from "unset". A frame with no areaId
      // is Unmapped, which is always a valid answer.
      if ((field === 'owner' || field === 'areaId') && value === '') frame.delete(field)
      else frame.set(field, value as never)
    },
    []
  )

  if (!pin) return null
  const set = (field: EditableField) => (value: string) =>
    editFrame(pin.frameId, field, value)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* key: a fresh frame gets fresh local field state, so no draft leaks
          from the frame that was open before it. */}
      <DialogContent
        key={pin.frameId}
        className="max-h-[85vh] max-w-2xl gap-3 overflow-y-auto p-5"
      >
        {/*
          The problem IS the title, in the same language as capture and as the
          new-card modal: a big borderless line you type straight into, with the
          frame's facts as pills under it. A separate "Problem" field below a
          generic heading made the frame read like a form.
        */}
        <DialogTitle className="sr-only">{pin.problem || 'Frame'}</DialogTitle>
        <DraftTitle value={pin.problem} onCommit={set('problem')} />
        {/*
          The pills ARE the inputs, the same as capture. Kind, Type and the owner
          are set right here; State, investment and fading are derived, so they
          read as plain pills that nobody can set.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <PillSelect
            value={pin.kind}
            onChange={set('kind')}
            label="Kind"
            options={KIND_OPTIONS}
            dot={pin.color}
          />
          <PillSelect
            value={pin.type}
            onChange={set('type')}
            label="Type"
            options={TYPE_OPTIONS}
          />
          {areas.length > 0 && (
            <PillSelect
              value={pin.areaId || UNMAPPED}
              onChange={(v) => set('areaId')(v === UNMAPPED ? '' : v)}
              label="Area"
              options={[
                { value: UNMAPPED, label: 'Unmapped' },
                ...areas.map((a) => ({ value: a.id, label: a.label })),
              ]}
            />
          )}
          <PillSelect
            value={pin.owner ?? NOBODY}
            onChange={(v) => set('owner')(v === NOBODY ? '' : v)}
            label="Frame owner"
            options={[
              { value: NOBODY, label: 'Nobody yet' },
              ...users.map((u) => ({ value: u.userId, label: u.name })),
            ]}
          />
          <span className={PILL}>{STATE_LABELS[pin.state]}</span>
          {pin.worked && <span className={PILL}>Worked before</span>}
          {pin.dim && <span className={PILL}>Fading</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {pin.sharp
            ? 'Sharp — it has both a problem and an appetite, so it can be bet on.'
            : 'Rough — a frame is sharp once it has both a problem and an appetite.'}
        </p>

        {/*
          Tabs, not one long scroll. A frame carries four different kinds of
          thing — the framing, the evidence, the dossier, and the history — and
          only one of them is ever the reason somebody opened it. The counts are
          on the tabs so nothing hides behind an unopened one.
        */}
        <Tabs defaultValue="framing" className="mt-1">
          <TabsList>
            <TabsTrigger value="framing">Framing</TabsTrigger>
            <TabsTrigger value="reports">
              Reports{pin.reports.length > 0 ? ` (${pin.reports.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="pointers">
              Pointers{pin.pointers.length > 0 ? ` (${pin.pointers.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* The same order and the same question as capture. A field that means
              one thing must not move between creating a frame and reading it. */}
          <TabsContent value="framing" className="flex flex-col gap-3 pt-2">
            <Field label={WHY_LABEL} hint="Who is affected, what it is worth, why now.">
              <DraftTextarea value={pin.businessCase} rows={4} onCommit={set('business_case')} />
            </Field>

            <Field label="Appetite" hint="The time the business will spend, e.g. 6 weeks.">
              <DraftInput value={pin.appetite} onCommit={set('appetite')} />
            </Field>

            {pin.candidateStatement && (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm italic">
                {pin.candidateStatement}
              </p>
            )}
          </TabsContent>

          <TabsContent value="reports" className="flex flex-col gap-3 pt-2">
            <Reports pin={pin} />
            {/* "Still hurts" belongs with the evidence: it is a mention without
                a new report, and this is where somebody looking at the evidence
                decides the problem is still live. */}
            <StillHurts pin={pin} />
          </TabsContent>

          <TabsContent value="pointers" className="flex flex-col gap-3 pt-2">
            <Pointers pin={pin} />
          </TabsContent>

          <TabsContent value="history" className="flex flex-col gap-3 pt-2">
            <Shapes pin={pin} />
            <Origin pin={pin} />
            <Resolve pin={pin} onClose={onClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

type EditableField =
  | 'problem'
  | 'appetite'
  | 'business_case'
  | 'kind'
  | 'type'
  | 'owner'
  | 'areaId'

/**
 * The origin chain, and the way to add to it.
 *
 * A quality or an adoption problem found while monitoring a release becomes a
 * NEW frame with a pointer back — never a reopening of this one. One frame text
 * cannot hold two differently-framed problems, and each deserves its own
 * appetite (ADR 0025). The chain then shows which releases create follow-on
 * pain, and nobody maintains it.
 */
function Origin({ pin }: { pin: RenderedPin }) {
  const openFrame = useContext(OpenFrameContext)
  const { userId } = useAuth()
  const [problem, setProblem] = useState('')
  const [type, setType] = useState<FrameType>('bug')

  const captureFrame = useProductMapMutation(({ storage }, frame: Frame) => {
    storage.get('frames').push(new LiveObject(frame))
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = problem.trim()
    if (!text) return
    captureFrame({
      id: nanoid(),
      kind: DEFAULT_KIND,
      type,
      problem: text,
      appetite: '',
      business_case: '',
      ...(pin.areaId ? { areaId: pin.areaId } : {}),
      ...(pin.owner ? { owner: pin.owner } : userId ? { owner: userId } : {}),
      // The pointer back. Capturing it never touches this frame: the origin
      // frame is not reopened, and it stays in monitoring.
      originFrameId: pin.frameId,
      reports: [],
      pointers: [],
      last_woken: getTeamToday(new Date()),
      resolved: false,
    })
    setProblem('')
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {pin.originChain.length > 0 && (
        <>
          <Label>Came out of</Label>
          <ol className="flex flex-col gap-1">
            {pin.originChain.map((link) => (
              <li key={link.frameId} className="text-sm">
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() => openFrame(link.frameId)}
                >
                  {link.problem}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      {(pin.state === 'released' || pin.state === 'monitoring') && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Label>Found a problem in this release?</Label>
          <p className="text-xs text-muted-foreground">
            It becomes a new frame pointing back at this one, with its own
            appetite. This frame stays in monitoring.
          </p>
          <Input
            placeholder="What is wrong now?"
            aria-label="Follow-on problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v) => setType(v as FrameType)}>
              <SelectTrigger className="w-36" aria-label="Follow-on Type">
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
            <Button type="submit" variant="outline" disabled={!problem.trim()}>
              Capture it
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * Resolve. Only a person does this, and nothing does it on a timer — shipping a
 * shape never silently claims the pain is over. Monitoring has no end condition,
 * so this is the only way out of it.
 */
function Resolve({ pin, onClose }: { pin: RenderedPin; onClose: () => void }) {
  const setResolved = useProductMapMutation(
    ({ storage }, frameId: string, resolved: boolean) => {
      const frame = storage.get('frames').find((f) => f.get('id') === frameId)
      if (!frame) return
      frame.set('resolved', resolved)
    },
    []
  )

  return (
    <div className="flex items-center justify-between gap-2 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        {pin.state === 'monitoring' || pin.state === 'released'
          ? 'Released. It stays in monitoring until somebody says the problem is gone.'
          : 'Resolve this when the problem is gone. Nothing resolves on a timer.'}
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-8 shrink-0"
        onClick={() => {
          setResolved(pin.frameId, true)
          onClose()
        }}
      >
        Resolve
      </Button>
    </div>
  )
}

/**
 * Every shape that attacked this frame, with its cycle, plus the way to bet on
 * it. A frame outlives the work done against it, so the same problem can be
 * attacked again years later and both bets stay visible. The list is read from
 * the cycle rooms and never stored on the frame (ADR 0022).
 */
function Shapes({ pin }: { pin: RenderedPin }) {
  const cycles = useContext(CyclesContext)
  const [cycleSlug, setCycleSlug] = useState('')
  const [error, setError] = useState('')
  const [betting, setBetting] = useState(false)

  async function bet() {
    setBetting(true)
    setError('')
    try {
      await betOnFrame({ frameId: pin.frameId, cycleSlug, title: pin.problem })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <Label>Bets on this frame ({pin.shapes.length})</Label>
      <ul className="flex flex-col gap-1">
        {pin.shapes.map((shape) => (
          <li key={shape.shapeId} className="text-sm">
            {shape.title}{' '}
            <span className="text-xs text-muted-foreground">
              {shape.cycleTitle} · {shape.stage}
            </span>
          </li>
        ))}
      </ul>
      {/* Only a sharp frame can be bet on, so a rough one is offered no bet at
          all. The action re-checks server-side: this is the courtesy, not the
          rule. */}
      {pin.sharp && cycles.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={cycleSlug} onValueChange={setCycleSlug}>
            <SelectTrigger className="h-8 flex-1" aria-label="Bet into cycle">
              <SelectValue placeholder="Bet into a cycle…" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.slug} value={cycle.slug}>
                  {cycle.title || cycle.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="h-8"
            disabled={!cycleSlug || betting}
            onClick={bet}
          >
            Bet
          </Button>
        </div>
      )}
      {!pin.sharp && (
        <p className="text-xs text-muted-foreground">
          Give this frame an appetite before betting on it. Nobody bets on half a
          frame.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/**
 * Opening a frame does NOT wake it. This button is how a reader who still feels
 * the problem says so on purpose (ADR 0024).
 */
function StillHurts({ pin }: { pin: RenderedPin }) {
  const wake = useWakeFrame()
  return (
    <div className="flex items-center justify-between gap-2 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        {pin.dormant
          ? 'Asleep — nobody has mentioned this for two cycles.'
          : pin.daysSinceWoken === null
            ? 'No freshness clock on this frame.'
            : `Last mentioned ${pin.daysSinceWoken} days ago.`}
      </p>
      <StillHurtsButton onWake={() => wake(pin.frameId)} />
    </div>
  )
}

/**
 * The dossier. A frame packages links and never copies the artifact, so the
 * whole dossier is reachable from one place without anything drifting.
 *
 * Under it, the **Gap list**: what this frame's playbook expects and the frame
 * does not have. It refuses nothing — it is a prompt, never a gate (ADR 0025).
 */
function Pointers({ pin }: { pin: RenderedPin }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<PointerKind>('issue')

  const addPointer = useProductMapMutation(
    ({ storage }, frameId: string, pointer: FramePointer) => {
      const frame = storage.get('frames').find((f) => f.get('id') === frameId)
      if (!frame) return
      const pointers = (frame.get('pointers') ?? []) as FramePointer[]
      frame.set('pointers', [...pointers, pointer])
      // Deliberately no wake: filing a link is not one of the three things that
      // wake a frame (ADR 0024).
    },
    []
  )

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const href = url.trim()
    if (!href) return
    addPointer(pin.frameId, {
      url: href,
      label: label.trim() || POINTER_KIND_LABELS[kind],
      kind,
    })
    setUrl('')
    setLabel('')
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <Label>Pointers ({pin.pointers.length})</Label>
      <ul className="flex flex-col gap-1.5">
        {pin.pointers.map((pointer, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-xs text-muted-foreground">
              {POINTER_KIND_LABELS[pointer.kind] ?? pointer.kind}
            </span>
            <a
              className="truncate underline"
              href={pointer.url}
              target="_blank"
              rel="noreferrer"
            >
              {pointer.label}
            </a>
          </li>
        ))}
      </ul>
      {pin.gaps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          A {TYPE_LABELS[pin.type].toLowerCase()} frame usually also points at:{' '}
          {pin.gaps.map((gap) => POINTER_KIND_LABELS[gap]).join(', ')}. Nothing is
          blocked while these are missing.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-40 flex-1"
          placeholder="https://…"
          aria-label="Pointer url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Select value={kind} onValueChange={(v) => setKind(v as PointerKind)}>
          <SelectTrigger className="w-40" aria-label="Pointer kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POINTER_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {POINTER_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-32"
          placeholder="Label"
          aria-label="Pointer label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!url.trim()}>
          Link
        </Button>
      </form>
    </div>
  )
}

/**
 * The evidence. A reader needs the reports and not only the count, so an agent's
 * frame can be judged by the person reading it — every report names its capturer.
 *
 * Adding a report also wakes the frame, because a fresh report IS the
 * conversation the freshness clock listens for (ADR 0024).
 */
function Reports({ pin }: { pin: RenderedPin }) {
  const users = useOrganizationUsers()
  const { userId } = useAuth()
  const [text, setText] = useState('')
  const [source, setSource] = useState<FrameReport['source']>('internal')
  const [customer, setCustomer] = useState('')

  const addReport = useProductMapMutation(
    ({ storage }, frameId: string, report: FrameReport, wokenOn: string) => {
      const frame = storage.get('frames').find((f) => f.get('id') === frameId)
      if (!frame) return
      const reports = (frame.get('reports') ?? []) as FrameReport[]
      frame.set('reports', [...reports, report])
      // The wake is the act of reporting, which happens now — the same rule the
      // writer follows, so a report never ages the frame it woke.
      frame.set('last_woken', wokenOn)
    },
    []
  )

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const line = text.trim()
    // Nothing reaches a frame unmediated: a report with no capturer would be an
    // anonymous claim, and the whole point is that a reader can judge who made
    // it. The submit button is disabled for the same reason.
    if (!line || !userId) return
    const today = getTeamToday(new Date())
    addReport(
      pin.frameId,
      {
        capturer: userId,
        source,
        ...(source === 'customer' && customer.trim() ? { customer: customer.trim() } : {}),
        text: line,
        date: today,
      },
      today
    )
    setText('')
    setCustomer('')
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <Label>Reports ({pin.reports.length})</Label>
      {pin.reports.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nobody has recorded this happening yet.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {pin.reports.map((report, i) => (
          <li key={i} className="rounded-lg border p-2 text-sm">
            <p>{report.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {SOURCE_LABELS[report.source]}
              {report.customer && ` · ${report.customer}`} · {report.date} · recorded by{' '}
              {capturerName(report.capturer, users)}
              {report.link && (
                <>
                  {' · '}
                  <a className="underline" href={report.link} target="_blank" rel="noreferrer">
                    link
                  </a>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Textarea
          rows={2}
          placeholder="What happened?"
          aria-label="Report"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Select
            value={source}
            onValueChange={(v) => setSource(v as FrameReport['source'])}
          >
            <SelectTrigger className="w-32" aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">{SOURCE_LABELS.internal}</SelectItem>
              <SelectItem value="customer">{SOURCE_LABELS.customer}</SelectItem>
            </SelectContent>
          </Select>
          {source === 'customer' && (
            <Input
              className="flex-1"
              placeholder="Which customer?"
              aria-label="Customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          )}
          <Button type="submit" variant="outline" disabled={!text.trim() || !userId}>
            Add report
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * A capturer is a Clerk user id OR an agent id, so a name lookup that misses is
 * normal. Show the raw id then: the provenance of an agent's report matters more
 * than a tidy label.
 */
function capturerName(capturer: string, users: OrganizationUser[]): string {
  return users.find((u) => u.userId === capturer)?.name ?? (capturer || 'unknown')
}

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

/** The frame's problem, styled as its heading rather than as a form field. */
function DraftTitle({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <textarea
      rows={2}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      placeholder="What hurts?…"
      aria-label="Problem"
      className={TITLE_INPUT}
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
 * Capture, in the same language as the new-card modal on the Scope Map: a big
 * borderless title, a row of pills, a divider, one primary action.
 *
 * The order is the order somebody thinks in. The title says what hurts. The
 * struggle says what the customer cannot do, and it becomes the frame's FIRST
 * REPORT rather than more prose — capture should leave evidence, not an
 * assertion. Then why it matters to Vasco, then the appetite.
 *
 * There is deliberately no outcome field. A frame holds the problem; an outcome
 * belongs to the Shape that attacks it, so the map stays about problems and
 * shaping stays about solutions.
 *
 * Only the title is required. Type selects the playbook (ADR 0025) and defaults
 * to a bug; Kind starts at pain_point so nobody has to grade a severity at 4pm
 * on a Friday; the area can stay Unmapped.
 */
function CaptureForm({
  areas,
  areaOwners,
  open,
  onOpenChange,
}: {
  areas: AreaOption[]
  areaOwners: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [problem, setProblem] = useState('')
  const [struggle, setStruggle] = useState('')
  const [customer, setCustomer] = useState('')
  const [why, setWhy] = useState('')
  const [appetite, setAppetite] = useState('')
  const [type, setType] = useState<FrameType>('bug')
  const [kind, setKind] = useState<FrameKind>(DEFAULT_KIND)
  const [areaId, setAreaId] = useState(UNMAPPED)
  const { userId } = useAuth()

  const captureFrame = useProductMapMutation(({ storage }, frame: Frame) => {
    storage.get('frames').push(new LiveObject(frame))
  }, [])

  function reset() {
    setProblem('')
    setStruggle('')
    setCustomer('')
    setWhy('')
    setAppetite('')
    setAreaId(UNMAPPED)
  }

  function create() {
    const text = problem.trim()
    if (!text) return
    const today = getTeamToday(new Date())
    // Every frame leaves capture owned. The area's owner is the suggestion, and
    // it is only a suggestion — the capturer changes it in the frame detail. An
    // Unmapped frame falls back to the capturer, because somebody must care.
    const owner = areaOwners[areaId] ?? userId ?? ''
    const struggleText = struggle.trim()
    const who = customer.trim()

    captureFrame({
      id: nanoid(),
      kind,
      type,
      problem: text,
      appetite: appetite.trim(),
      business_case: why.trim(),
      ...(areaId === UNMAPPED ? {} : { areaId }),
      ...(owner ? { owner } : {}),
      // The struggle is the first report. Naming a customer makes it a customer
      // report, which is what the customer Heat lens reads.
      reports: struggleText
        ? [
            {
              capturer: userId ?? 'unknown',
              source: who ? ('customer' as const) : ('internal' as const),
              ...(who ? { customer: who } : {}),
              text: struggleText,
              date: today,
            },
          ]
        : [],
      pointers: [],
      // A frame is born awake. Its clock starts on the day it was captured.
      last_woken: today,
      resolved: false,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl gap-3 overflow-y-auto p-5">
        <DialogTitle className="sr-only">Capture a frame</DialogTitle>
        <textarea
          autoFocus
          rows={2}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          onKeyDown={(e) => {
            // Enter creates, so a frame noticed in passing costs one line and a
            // keystroke. Shift+Enter still breaks the line.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              create()
            }
          }}
          placeholder="What hurts?…"
          aria-label="Problem"
          className={TITLE_INPUT}
        />

        {/* The same pills the frame form uses, in the same place: directly under
            the title. Capturing a frame and reading one are the same gesture. */}
        <div className="flex flex-wrap items-center gap-2">
          <PillSelect
            value={kind}
            onChange={(v) => setKind(v as FrameKind)}
            label="Kind"
            options={KIND_OPTIONS}
            dot={KIND_COLORS[kind]}
          />
          <PillSelect
            value={type}
            onChange={(v) => setType(v as FrameType)}
            label="Type"
            options={TYPE_OPTIONS}
          />
          {areas.length > 0 && (
            <PillSelect
              value={areaId}
              onChange={setAreaId}
              label="Area"
              options={[
                { value: UNMAPPED, label: 'Unmapped' },
                ...areas.map((a) => ({ value: a.id, label: a.label })),
              ]}
            />
          )}
        </div>

        {/*
          The same tab row the frame form has. Reports, pointers and history all
          need a frame to point at, so they are shown and disabled rather than
          hidden: what a frame will hold is visible from the moment it is made.
        */}
        <Tabs value="framing" className="mt-1">
          <TabsList>
            <TabsTrigger value="framing">Framing</TabsTrigger>
            <TabsTrigger value="reports" disabled title="Once the frame exists">
              Reports
            </TabsTrigger>
            <TabsTrigger value="pointers" disabled title="Once the frame exists">
              Pointers
            </TabsTrigger>
            <TabsTrigger value="history" disabled title="Once the frame exists">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="framing" className="flex flex-col gap-3 pt-2">
            <Field label={WHY_LABEL} hint="Who is affected, what it is worth, why now.">
              <Textarea
                rows={3}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Free text — nobody scores this."
              />
            </Field>

            <Field label="Appetite" hint="The time the business will spend, e.g. 6 weeks.">
              <Input
                value={appetite}
                onChange={(e) => setAppetite(e.target.value)}
                placeholder="Two weeks, six weeks… a frame is sharp once it has one."
                aria-label="Appetite"
              />
            </Field>

            {/*
              The struggle is the frame's first report, so it belongs to the
              Reports tab — but that tab cannot exist yet, and capture has to
              stay one screen. It sits here, named for what it becomes.
            */}
            <Field
              label="First report — what is the customer struggling with?"
              hint="Name a customer and it counts as a customer report, which is what the customer Heat lens reads."
            >
              <Textarea
                rows={2}
                value={struggle}
                onChange={(e) => setStruggle(e.target.value)}
                placeholder="What they cannot do today, in their words."
              />
              <Input
                className="mt-1.5"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Which customer? Leave empty if this came from us."
                aria-label="Customer"
              />
            </Field>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border pt-3">
          <Button onClick={create} disabled={!problem.trim()}>
            Capture frame
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProductMapSkeleton() {
  return (
    <Shell>
      <div className="h-48 animate-pulse rounded-xl border border-dashed bg-muted/40" />
    </Shell>
  )
}

/**
 * One CTA, two ways in. Capture with AI is the route that scales — an agent
 * interviews you and fills the frame — and manual capture is the 4pm-on-a-Friday
 * escape hatch, so noticing a problem never waits for an agent.
 */
function CaptureMenu({
  areas,
  areaOwners,
}: {
  areas: AreaOption[]
  areaOwners: Record<string, string>
}) {
  const [manual, setManual] = useState(false)
  const [withAi, setWithAi] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Capture</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setWithAi(true)}>
            Capture with AI
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManual(true)}>
            Capture manually
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CaptureForm areas={areas} areaOwners={areaOwners} open={manual} onOpenChange={setManual} />
      <AiCaptureDialog open={withAi} onOpenChange={setWithAi} />
    </>
  )
}

/**
 * There is nothing to fill in here. Capture through an agent happens in the
 * conversation, so this says what to say and gets out of the way.
 */
function AiCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-5">
        <DialogTitle className="font-display text-lg">Capture with AI</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Tell Claude what hurts and it fills the frame in: the problem, the
          area it belongs to, the Kind, the Type, and the customers who raised
          it. It writes to this map through the Cycles MCP server, so nothing
          gets pasted anywhere.
        </p>
        <AskClaude />
        <p className="text-xs text-muted-foreground">
          Claude will ask about anything it needs. If you would rather not be
          interviewed, capture manually instead.
        </p>
      </DialogContent>
    </Dialog>
  )
}

/** Example prompts, shown wherever somebody needs an agent to do the work. */
function AskClaude({ drawTheMap = false }: { drawTheMap?: boolean }) {
  const examples = drawTheMap
    ? [
        'Draw our product map. We have a front office (Slack, email, CRM write-back), a back office (MCP, onboarding, the agent and metric engines) and ten connector categories.',
        'Read our integration requests in Notion and capture a frame for each one, in the right area.',
      ]
    : [
        'Capture a frame: Stripe refunds are counted as revenue. Four customers have raised it.',
        'Botpress is blocked because reconciliation only matches account-type fields. Capture that as a brand burn on Definitions.',
        'Read yesterday\'s betting table notes and capture a frame for every product problem in them.',
      ]

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Say something like</p>
      <ul className="flex flex-col gap-1.5">
        {examples.map((example) => (
          <li
            key={example}
            className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed"
          >
            {example}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Shell({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-6 py-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Product Map</h1>
        {action}
      </div>
      {children}
    </main>
  )
}
