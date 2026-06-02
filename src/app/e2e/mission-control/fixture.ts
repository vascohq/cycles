import type { MissionControlViewProps } from '@/components/mission-control'
import type { PitchCard } from '@/lib/mission-control-helpers'

const inFlight: PitchCard[] = [
  {
    id: 'p1',
    title: 'Redesign dashboard',
    stage: 'building',
    needle: { progress: 0.7, zone: 'on_track' },
    tasksDone: 8,
    tasksTotal: 12,
    scopesTotal: 12,
    lastUpdatedAt: '2026-06-08T14:30:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
  {
    id: 'p2',
    title: 'Mobile push notifications',
    stage: 'shaping',
    needle: { progress: 0.4, zone: 'some_risk' },
    tasksDone: 3,
    tasksTotal: 9,
    scopesTotal: 9,
    lastUpdatedAt: '2026-06-05T10:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
  {
    id: 'p3',
    title: 'Search overhaul',
    stage: 'building',
    needle: { progress: 0.2, zone: 'concerned' },
    tasksDone: 1,
    tasksTotal: 7,
    scopesTotal: 7,
    lastUpdatedAt: '2026-06-01T09:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
  {
    id: 'p4',
    title: 'Onboarding v2',
    stage: 'framing',
    needle: null,
    tasksDone: 0,
    tasksTotal: 0,
    scopesTotal: 0,
    lastUpdatedAt: null,
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
]

const done: PitchCard[] = [
  {
    id: 'p5',
    title: 'API rate limiting',
    stage: 'done',
    needle: { progress: 0.9, zone: 'on_track' },
    tasksDone: 5,
    tasksTotal: 5,
    scopesTotal: 5,
    lastUpdatedAt: '2026-05-30T16:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
]

export const FIXTURE: MissionControlViewProps = {
  slug: 'vasco',
  cycleSlug: 'cycle-34',
  cycleTitle: 'Cycle 34',
  today: '2026-06-10',
  inFlight,
  done,
}
