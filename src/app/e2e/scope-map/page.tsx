'use client'

import { ScopeMapView } from '@/components/scope-map'
import { FIXTURE } from './fixture'
import { useState } from 'react'
import type { Stage } from '@/cycle-liveblocks.config'
import { nanoid } from 'nanoid'
import { resolveSquadByName, assignSquadColor } from '@/lib/squad-engine'

export default function ScopeMapE2EPage() {
  const [pitch, setPitch] = useState(FIXTURE.pitch)
  const [scopeGridItems, setScopeGridItems] = useState(FIXTURE.scopeGridItems)
  const [parkingLotItems, setParkingLotItems] = useState(FIXTURE.parkingLotItems)
  const [squads, setSquads] = useState(FIXTURE.squads ?? [])
  const [currentSquadId, setCurrentSquadId] = useState(FIXTURE.currentSquadId)

  const totalProgress = {
    done: scopeGridItems.flatMap((s) => s.tasks).filter((t) => t.done).length,
    total: scopeGridItems.flatMap((s) => s.tasks).length,
  }

  return (
    <ScopeMapView
      {...FIXTURE}
      pitch={pitch}
      scopeGridItems={scopeGridItems}
      parkingLotItems={parkingLotItems}
      totalProgress={totalProgress}
      squads={squads}
      currentSquadId={currentSquadId}
      onAssignSquad={(name) =>
        setSquads((list) => {
          const existing = resolveSquadByName(list, name)
          if (existing) {
            setCurrentSquadId(existing.id)
            return list
          }
          const id = nanoid()
          setCurrentSquadId(id)
          return [
            ...list,
            { id, name, color: assignSquadColor(list.map((s) => s.color)) },
          ]
        })
      }
      onClearSquad={() => setCurrentSquadId(undefined)}
      onRenameSquad={(squadId, name) =>
        setSquads((list) =>
          list.map((s) => (s.id === squadId ? { ...s, name } : s))
        )
      }
      onRecolorSquad={(squadId, color) =>
        setSquads((list) =>
          list.map((s) => (s.id === squadId ? { ...s, color } : s))
        )
      }
      onDeleteSquad={(squadId) => {
        setSquads((list) => list.filter((s) => s.id !== squadId))
        setCurrentSquadId((cur) => (cur === squadId ? undefined : cur))
      }}
      onStageChange={(stage: Stage) =>
        setPitch((p) => ({ ...p, stage }))
      }
      onEmojiChange={(emoji) => setPitch((p) => ({ ...p, emoji }))}
      onNotionUrlChange={(notion_url) =>
        setPitch((p) => ({ ...p, notion_url }))
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
      onAddScope={(title, tier, litmus_text) =>
        setScopeGridItems((items) => [
          ...items,
          {
            id: nanoid(),
            order: items.length + 1,
            title,
            tier: tier as 'must' | 'should' | 'could',
            color: '#3e63dd',
            litmus_text,
            tasks: [],
          },
        ])
      }
      onEditScope={(scopeId, fields) =>
        setScopeGridItems((items) =>
          items.map((s) => (s.id === scopeId ? { ...s, ...fields } : s))
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
  )
}
