'use client'

import { useState } from 'react'
import { Skeleton } from 'boneyard-js/react'
import { MissionControlView } from '@/components/mission-control'
import { FIXTURE } from './fixture'
import type { PitchCard } from '@/lib/mission-control-helpers'

export default function MissionControlE2EPage() {
  const [inFlight, setInFlight] = useState(FIXTURE.inFlight)

  return (
    <Skeleton
      name="mission-control"
      loading={false}
      className="w-full max-w-screen-lg mx-auto"
    >
      <MissionControlView
        {...FIXTURE}
        inFlight={inFlight}
        onCreatePitch={(title) =>
          setInFlight((prev) => [
            ...prev,
            {
              id: `p-${Date.now()}`,
              title,
              stage: 'framing' as const,
              needle: null,
              tasksDone: 0,
              tasksTotal: 0,
              lastUpdatedAt: null,
              timebox_start: '2026-05-26',
              timebox_end: '2026-07-03',
            } satisfies PitchCard,
          ])
        }
      />
    </Skeleton>
  )
}
