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
import type { Frame, FrameKind, FrameType } from '@/product-map-liveblocks.config'
import {
  DEFAULT_KIND,
  FRAME_KINDS,
  FRAME_TYPES,
  renderProductMap,
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
  // Guarded read: `initialStorage` only seeds a brand-new room, so a room whose
  // root predates the frames list must still render, not throw.
  const frames = useProductMapStorage(
    (root) => (root.frames ?? []) as unknown as Frame[]
  )

  // Today is a parameter of the engine, never a clock inside it. Resolved here
  // in the team timezone, the same as every other date-derived surface.
  const { pins } = renderProductMap({ frames, today: getTeamToday(new Date()) })

  return (
    <Shell>
      <CaptureForm />
      {pins.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <p className="font-display text-lg">Nothing on the Product Map yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A frame records one problem in your product. The first frame you
            capture appears here as a pin.
          </p>
        </div>
      ) : (
        // Areas draw the land in #220. Until then every pin is Unmapped, so one
        // flat field is the honest picture rather than a fake geography.
        <ul className="flex flex-wrap gap-3 rounded-xl border border-dashed p-6">
          {pins.map((pin) => (
            <PinDot key={pin.frameId} pin={pin} />
          ))}
        </ul>
      )}
    </Shell>
  )
}

function PinDot({ pin }: { pin: RenderedPin }) {
  return (
    <li className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: pin.color }}
      />
      <span className="truncate max-w-[24rem]">{pin.problem}</span>
      <span className="text-xs text-muted-foreground">
        {KIND_LABELS[pin.kind]} · {TYPE_LABELS[pin.type]}
      </span>
    </li>
  )
}

/**
 * Capture costs one line and a Type. Type is required because it selects the
 * playbook (ADR 0025); everything else can wait for somebody to sharpen the
 * frame. Kind starts at pain_point so nobody has to grade a severity at 4pm on
 * a Friday.
 */
function CaptureForm() {
  const [problem, setProblem] = useState('')
  const [type, setType] = useState<FrameType>('bug')
  const [kind, setKind] = useState<FrameKind>(DEFAULT_KIND)

  const captureFrame = useProductMapMutation(
    ({ storage }, frame: Frame) => {
      storage.get('frames').push(new LiveObject(frame))
    },
    []
  )

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
      reports: [],
      pointers: [],
      // A frame is born awake. Its clock starts on the day it was captured.
      last_woken: getTeamToday(new Date()),
      resolved: false,
    })
    setProblem('')
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 flex flex-wrap items-center gap-2">
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
      <Button type="submit" disabled={!problem.trim()}>
        Capture
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
