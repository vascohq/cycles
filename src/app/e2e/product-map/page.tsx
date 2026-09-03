'use client'

import { useState } from 'react'

import { MapCanvas } from '@/components/product-map/map-canvas'
import {
  DEFAULT_LENS,
  HEAT_LENSES,
  renderProductMap,
  type HeatLens,
} from '@/lib/product-map-engine'

import { AREAS, CYCLES, FRAMES, SHAPES, TODAY } from './fixture'

const LENS_LABELS: Record<HeatLens, string> = {
  all: 'Everyone',
  internal: 'Internal only',
  customer: 'Customers only',
}

/**
 * The Product Map's spatial surface against fixture data. No Liveblocks, no
 * Clerk, a fixed `today` — so the land, the zoom ladder and the heat lens can be
 * driven without a room.
 */
export default function ProductMapE2EPage() {
  const [lens, setLens] = useState<HeatLens>(DEFAULT_LENS)
  const [opened, setOpened] = useState<string | null>(null)

  const model = renderProductMap({
    areas: AREAS,
    frames: FRAMES,
    cycles: CYCLES,
    shapes: SHAPES,
    lens,
    today: TODAY,
  })

  return (
    // `w-full` matters: mx-auto on a flex item makes it shrink-to-fit, and a
    // canvas sized as a percentage of a shrink-to-fit parent never settles.
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-6">
      <h1 className="font-display text-xl">Product Map</h1>

      <div className="flex items-center gap-2" role="group" aria-label="Heat lens">
        {HEAT_LENSES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLens(option)}
            aria-pressed={lens === option}
            className={`rounded-full border px-3 py-1 text-sm ${
              lens === option ? 'bg-foreground text-background' : 'bg-background'
            }`}
          >
            {LENS_LABELS[option]}
          </button>
        ))}
      </div>

      <MapCanvas areas={model.areas} onOpenFrame={setOpened} />

      <p data-testid="opened-frame" className="text-sm text-muted-foreground">
        {opened ? `Opened: ${opened}` : 'No frame open'}
      </p>

      <p data-testid="counts" className="text-sm text-muted-foreground">
        {model.pins.filter((p) => p.passesLens).length} on the map ·{' '}
        {model.unmapped.length} unmapped · {model.resolved.length} resolved
      </p>
    </main>
  )
}
