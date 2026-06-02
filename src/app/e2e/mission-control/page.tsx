'use client'

import { useState } from 'react'
import { MissionControlView } from '@/components/mission-control'
import { groupBySquad, type PitchCard } from '@/lib/mission-control-helpers'
import { FIXTURE, CARDS, SQUADS } from './fixture'

export default function MissionControlE2EPage() {
  const [cards, setCards] = useState<PitchCard[]>(CARDS)
  const sections = groupBySquad(cards, SQUADS)

  return (
    <MissionControlView
      {...FIXTURE}
      sections={sections}
      onCreatePitch={(title) =>
        setCards((prev) => [
          ...prev,
          {
            id: `p-${Date.now()}`,
            title,
            emoji: '',
            stage: 'framing' as const,
            needle: null,
            tasksDone: 0,
            tasksTotal: 0,
            scopesTotal: 0,
            lastUpdatedAt: null,
            timebox_start: '2026-05-26',
            timebox_end: '2026-07-03',
          } satisfies PitchCard,
        ])
      }
    />
  )
}
