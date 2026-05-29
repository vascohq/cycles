'use client'

import { Skeleton } from 'boneyard-js/react'
import { ScopeMapView } from '@/components/scope-map'
import { FIXTURE } from './fixture'
import { useState } from 'react'
import type { Stage } from '@/cycle-liveblocks.config'
import { nanoid } from 'nanoid'

export default function ScopeMapE2EPage() {
  const [pitch, setPitch] = useState(FIXTURE.pitch)
  const [scopeGridItems, setScopeGridItems] = useState(FIXTURE.scopeGridItems)
  const [parkingLotItems, setParkingLotItems] = useState(FIXTURE.parkingLotItems)

  const totalProgress = {
    done: scopeGridItems.flatMap((s) => s.tasks).filter((t) => t.done).length,
    total: scopeGridItems.flatMap((s) => s.tasks).length,
  }

  return (
    <Skeleton
      name="scope-map"
      loading={false}
      className="w-full max-w-screen-lg mx-auto"
    >
    <ScopeMapView
      {...FIXTURE}
      pitch={pitch}
      scopeGridItems={scopeGridItems}
      parkingLotItems={parkingLotItems}
      totalProgress={totalProgress}
      onStageChange={(stage: Stage) =>
        setPitch((p) => ({ ...p, stage }))
      }
      onTaskToggle={(scopeId, taskId, done) =>
        setScopeGridItems((items) =>
          items.map((s) =>
            s.id === scopeId
              ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) }
              : s
          )
        )
      }
      onAddScope={(title, tier) =>
        setScopeGridItems((items) => [
          ...items,
          {
            id: nanoid(),
            order: items.length + 1,
            title,
            tier: tier as 'must' | 'should' | 'could',
            litmus_text: '',
            tasks: [],
          },
        ])
      }
      onEditScope={(scopeId, title, tier) =>
        setScopeGridItems((items) =>
          items.map((s) =>
            s.id === scopeId
              ? { ...s, title, tier: tier as 'must' | 'should' | 'could' }
              : s
          )
        )
      }
      onDeleteScope={(scopeId) =>
        setScopeGridItems((items) => items.filter((s) => s.id !== scopeId))
      }
      onParkingToggle={(itemId, resolved) =>
        setParkingLotItems((items) =>
          items.map((i) => (i.id === itemId ? { ...i, resolved } : i))
        )
      }
    />
    </Skeleton>
  )
}
