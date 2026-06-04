import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { MissionControlView } from './mission-control-view'
import {
  groupBySquad,
  type PitchCard,
  type SquadLike,
} from '@/lib/mission-control-helpers'

const squads: SquadLike[] = [
  { id: 'sq-platform', name: 'Platform', color: '#3e63dd' },
  { id: 'sq-growth', name: 'Growth', color: '#e5484d' },
]

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
    squadId: 'sq-platform',
    title: 'Redesign dashboard',
    emoji: '📊',
    stage: 'building',
    needle: { progress: 0.7, zone: 'on_track' },
    tasksDone: 8,
    tasksTotal: 12,
    scopesTotal: 12,
    lastUpdatedAt: new Date(Date.now() - 3_600_000).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p2',
    squadId: 'sq-growth',
    title: 'Mobile push notifications',
    emoji: '📱',
    stage: 'shaping',
    needle: { progress: 0.4, zone: 'some_risk' },
    tasksDone: 3,
    tasksTotal: 9,
    scopesTotal: 9,
    lastUpdatedAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p3',
    squadId: 'sq-growth',
    title: 'Search overhaul',
    emoji: '🔍',
    stage: 'building',
    needle: { progress: 0.2, zone: 'concerned' },
    tasksDone: 1,
    tasksTotal: 7,
    scopesTotal: 7,
    lastUpdatedAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
  {
    id: 'p4',
    title: 'Onboarding v2',
    emoji: '',
    stage: 'framing',
    needle: null,
    tasksDone: 0,
    tasksTotal: 0,
    scopesTotal: 0,
    lastUpdatedAt: null,
    timebox_start: '2025-01-06',
    timebox_end: '2025-02-14',
  },
]

const doneCards: PitchCard[] = [
  {
    id: 'p5',
    squadId: 'sq-platform',
    title: 'API rate limiting',
    emoji: '🚦',
    stage: 'done',
    needle: { progress: 0.9, zone: 'on_track' },
    tasksDone: 5,
    tasksTotal: 5,
    scopesTotal: 5,
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
    cycleStart: '2025-01-06',
    cycleEnd: '2025-02-14',
    sections: groupBySquad([...inFlightCards, ...doneCards], squads),
  },
}

export const Empty: Story = {
  args: {
    slug: 'acme',
    cycleSlug: 'cycle-5',
    cycleTitle: 'Cycle 5 — Build',
    today: '2025-01-27',
    cycleStart: '2025-01-06',
    cycleEnd: '2025-02-14',
    sections: [],
  },
}

export const AllDone: Story = {
  args: {
    slug: 'acme',
    cycleSlug: 'cycle-5',
    cycleTitle: 'Cycle 5 — Build',
    today: '2025-02-14',
    cycleStart: '2025-01-06',
    cycleEnd: '2025-02-14',
    sections: groupBySquad(
      [
        ...inFlightCards.map((c) => ({ ...c, stage: 'done' as const })),
        ...doneCards,
      ],
      squads
    ),
  },
}

export const WithCreatePitch: Story = {
  render: function Render() {
    const [pitches, setPitches] = useState<PitchCard[]>([
      ...inFlightCards,
      ...doneCards,
    ])

    return (
      <MissionControlView
        slug="acme"
        cycleSlug="cycle-5"
        cycleTitle="Cycle 5 — Build"
        today="2025-01-27"
        cycleStart="2025-01-06"
        cycleEnd="2025-02-14"
        sections={groupBySquad(pitches, squads)}
        onCreatePitch={(title) =>
          setPitches((prev) => [
            ...prev,
            {
              id: `p-${Date.now()}`,
              title,
              emoji: '',
              stage: 'framing',
              needle: null,
              tasksDone: 0,
              tasksTotal: 0,
              scopesTotal: 0,
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
