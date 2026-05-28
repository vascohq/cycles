import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { MissionControlView } from './mission-control-view'
import type { PitchCard } from '@/lib/mission-control-helpers'

const meta: Meta<typeof MissionControlView> = {
  title: 'Pages/MissionControl',
  component: MissionControlView,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof MissionControlView>

const inFlightCards: PitchCard[] = [
  {
    id: 'p1',
    title: 'Redesign dashboard',
    stage: 'building',
    needle: { progress: 0.7, zone: 'on_track' },
    tasksDone: 8,
    tasksTotal: 12,
    lastUpdatedAt: new Date(Date.now() - 3_600_000).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p2',
    title: 'Mobile push notifications',
    stage: 'shaping',
    needle: { progress: 0.4, zone: 'some_risk' },
    tasksDone: 3,
    tasksTotal: 9,
    lastUpdatedAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p3',
    title: 'Search overhaul',
    stage: 'building',
    needle: { progress: 0.2, zone: 'concerned' },
    tasksDone: 1,
    tasksTotal: 7,
    lastUpdatedAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p4',
    title: 'Onboarding v2',
    stage: 'framing',
    needle: null,
    tasksDone: 0,
    tasksTotal: 0,
    lastUpdatedAt: null,
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
]

const doneCards: PitchCard[] = [
  {
    id: 'p5',
    title: 'API rate limiting',
    stage: 'done',
    needle: { progress: 0.9, zone: 'on_track' },
    tasksDone: 5,
    tasksTotal: 5,
    lastUpdatedAt: new Date(Date.now() - 86_400_000 * 10).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
]

export const Default: Story = {
  args: {
    slug: 'acme',
    cycleSlug: 'cycle-5',
    cycleTitle: 'Cycle 5 — Build',
    today: '2025-01-27',
    inFlight: inFlightCards,
    done: doneCards,
  },
}

export const Empty: Story = {
  args: {
    slug: 'acme',
    cycleSlug: 'cycle-5',
    cycleTitle: 'Cycle 5 — Build',
    today: '2025-01-27',
    inFlight: [],
    done: [],
  },
}

export const AllDone: Story = {
  args: {
    slug: 'acme',
    cycleSlug: 'cycle-5',
    cycleTitle: 'Cycle 5 — Build',
    today: '2025-02-14',
    inFlight: [],
    done: [...inFlightCards.map((c) => ({ ...c, stage: 'done' as const })), ...doneCards],
  },
}

export const WithCreatePitch: Story = {
  render: function Render() {
    const [pitches, setPitches] = useState<PitchCard[]>([...inFlightCards])

    return (
      <MissionControlView
        slug="acme"
        cycleSlug="cycle-5"
        cycleTitle="Cycle 5 — Build"
        today="2025-01-27"
        inFlight={pitches}
        done={doneCards}
        onCreatePitch={(title) =>
          setPitches((prev) => [
            ...prev,
            {
              id: `p-${Date.now()}`,
              title,
              stage: 'framing',
              needle: null,
              tasksDone: 0,
              tasksTotal: 0,
              lastUpdatedAt: null,
              timebox_start: '2025-01-06',
              timebox_end: '2025-02-14',
            },
          ])
        }
      />
    )
  },
}
