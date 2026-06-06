import type { PitchCard, SquadLike } from '@/lib/mission-control-helpers'
import type { OverlayBand } from '@/lib/calendar/ics-normalizer'

export const SQUADS: SquadLike[] = [
  { id: 'sq-platform', name: 'Platform', color: '#3e63dd' },
  { id: 'sq-growth', name: 'Growth', color: '#e5484d' },
]

// Pitch cards with squad assignments. groupBySquad orders sections by the
// SQUADS list (Platform, then Growth), with Onboarding v2 falling into a
// trailing "Unassigned" section.
export const CARDS: PitchCard[] = [
  {
    id: 'p1',
    title: 'Redesign dashboard',
    emoji: '📊',
    stage: 'building',
    needle: { progress: 0.7, zone: 'on_track' },
    tasksDone: 8,
    tasksTotal: 12,
    scopesTotal: 12,
    lastUpdatedAt: '2026-06-08T14:30:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
    squadId: 'sq-platform',
  },
  {
    id: 'p2',
    title: 'Mobile push notifications',
    emoji: '📱',
    stage: 'shaping',
    needle: { progress: 0.4, zone: 'some_risk' },
    tasksDone: 3,
    tasksTotal: 9,
    scopesTotal: 9,
    lastUpdatedAt: '2026-06-05T10:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
    squadId: 'sq-growth',
  },
  {
    id: 'p3',
    title: 'Search overhaul',
    emoji: '🔍',
    stage: 'building',
    needle: { progress: 0.2, zone: 'concerned' },
    tasksDone: 1,
    tasksTotal: 7,
    scopesTotal: 7,
    lastUpdatedAt: '2026-06-01T09:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
    squadId: 'sq-growth',
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
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
  },
  {
    id: 'p5',
    title: 'API rate limiting',
    emoji: '🚦',
    stage: 'done',
    needle: { progress: 0.9, zone: 'on_track' },
    tasksDone: 5,
    tasksTotal: 5,
    scopesTotal: 5,
    lastUpdatedAt: '2026-05-30T16:00:00Z',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
    squadId: 'sq-platform',
  },
]

export const FIXTURE = {
  slug: 'vasco',
  cycleSlug: 'cycle-34',
  cycleTitle: 'Cycle 34',
  today: '2026-06-10',
  cycleStart: '2026-05-26',
  cycleEnd: '2026-07-03',
}

// Sample overlay bands for the cycle window. In production these come from
// fetched + normalized calendar feeds; here they exercise the layers on the
// tape — two Holiday feeds in distinct colors (Canada blue, France purple), a
// weekend holiday that shifts to its observed Monday (dashed), and a Time Off
// feed (Humi green) with overlapping absences that lane-stack.
const CA = '#3e63dd' // blue
const FR = '#8e4ec6' // purple
const HUMI = '#30a46c' // green

export const CYCLE_BANDS: OverlayBand[] = [
  { kind: 'holiday', label: 'Canada', color: CA, summary: 'St-Jean-Baptiste Day', startDate: '2026-06-24', endDate: '2026-06-24' },
  { kind: 'holiday', label: 'Canada', color: CA, summary: 'Canada Day', startDate: '2026-07-01', endDate: '2026-07-01' },
  { kind: 'holiday', label: 'Canada', color: CA, summary: 'Victoria Day (before cycle)', startDate: '2026-05-18', endDate: '2026-05-18' },
  // A weekend holiday (Sat Jun 20) — observed on the following Monday, dashed.
  { kind: 'holiday', label: 'Canada', color: CA, summary: 'Weekend holiday', startDate: '2026-06-20', endDate: '2026-06-20' },
  // A second Holiday feed (France), distinct color, on the same first line.
  { kind: 'holiday', label: 'France', color: FR, summary: 'Lundi de Pentecôte', startDate: '2026-06-01', endDate: '2026-06-01' },
  // A lone absence early in the cycle, then three overlapping ones late.
  { kind: 'timeoff', label: 'Humi', color: HUMI, summary: 'Justin — Vacation', startDate: '2026-06-08', endDate: '2026-06-08' },
  { kind: 'timeoff', label: 'Humi', color: HUMI, summary: 'Laura — Vacation', startDate: '2026-06-24', endDate: '2026-06-26' },
  { kind: 'timeoff', label: 'Humi', color: HUMI, summary: 'Xavier — Vacation', startDate: '2026-06-25', endDate: '2026-06-30' },
  { kind: 'timeoff', label: 'Humi', color: HUMI, summary: 'Alec — Vacation', startDate: '2026-06-28', endDate: '2026-07-01' },
]
