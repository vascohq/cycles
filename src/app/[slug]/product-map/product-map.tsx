'use client'

import { useState } from 'react'
import { ClientSideSuspense } from '@liveblocks/react'
import { LiveObject } from '@liveblocks/client'
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
  type RenderedArea,
  type RenderedPin,
} from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

/** The Select value that stands for "no area". Empty string is not selectable. */
const UNMAPPED = '__unmapped__'

export function ProductMap({ roomId }: { roomId: string }) {
  return (
    <ProductMapRoomProvider
      id={roomId}
      initialPresence={{}}
      initialStorage={productMapInitialStorage()}
    >
      <ClientSideSuspense fallback={<ProductMapSkeleton />}>
        {() => <ProductMapView />}
      </ClientSideSuspense>
    </ProductMapRoomProvider>
  )
}

function ProductMapView() {
  // Guarded reads: `initialStorage` only seeds a brand-new room, so a room whose
  // root predates either list must still render, not throw.
  const frames = useProductMapStorage((root) => (root.frames ?? []) as unknown as Frame[])
  const areas = useProductMapStorage((root) => (root.areas ?? []) as unknown as Area[])

  // Today is a parameter of the engine, never a clock inside it. Resolved here
  // in the team timezone, the same as every other date-derived surface.
  const model = renderProductMap({ areas, frames, today: getTeamToday(new Date()) })
  const options = areaOptions(model.areas)

  return (
    <Shell>
      <CaptureForm areas={options} />
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
    </Shell>
  )
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
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: pin.color }}
      />
      <span className="truncate">{pin.problem}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {KIND_LABELS[pin.kind]} · {TYPE_LABELS[pin.type]}
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
 * Capture costs one line and a Type. Type is required because it selects the
 * playbook (ADR 0025); everything else can wait for somebody to sharpen the
 * frame. Kind starts at pain_point so nobody has to grade a severity at 4pm on
 * a Friday, and the area can stay Unmapped.
 */
function CaptureForm({ areas }: { areas: AreaOption[] }) {
  const [problem, setProblem] = useState('')
  const [type, setType] = useState<FrameType>('bug')
  const [kind, setKind] = useState<FrameKind>(DEFAULT_KIND)
  const [areaId, setAreaId] = useState(UNMAPPED)

  const captureFrame = useProductMapMutation(({ storage }, frame: Frame) => {
    storage.get('frames').push(new LiveObject(frame))
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = problem.trim()
    if (!text) return
    captureFrame({
      id: nanoid(),
      kind,
      type,
      problem: text,
      appetite: '',
      business_case: '',
      ...(areaId === UNMAPPED ? {} : { areaId }),
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
