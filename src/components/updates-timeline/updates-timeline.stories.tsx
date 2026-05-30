import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { UpdatesTimeline } from './updates-timeline'
import { deriveTimelineCards } from '@/lib/timeline-helpers'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

const meta: Meta<typeof UpdatesTimeline> = {
  title: 'Components/UpdatesTimeline',
  component: UpdatesTimeline,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof UpdatesTimeline>

const users = new Map([
  ['bob', { name: 'Bob', initials: 'B' }],
  ['alice', { name: 'Alice', initials: 'A' }],
  ['seb', { name: 'Seb', initials: 'S' }],
])

// Three stored updates. Each card's movement is the frozen diff between its own
// hill_snapshot and the previous update's — derived through the shared engine.
const updates: PitchUpdate[] = [
  {
    id: 'u1',
    pitchId: 'p1',
    posted_at: '2025-06-03T14:30:00Z',
    posted_by: 'bob',
    narrative:
      'Kicked off the cycle. Needle engine and gauge are done. Starting hill chart work this week.',
    needle_snapshot: { progress: 0.2, zone: 'concerned' },
    // First-ever update: no prior snapshot → every scope renders as "New".
    hill_snapshot: [
      { scopeId: 's1', hill_progress: 0.1, title: 'Hill chart engine', tier: 'must' },
      { scopeId: 's2', hill_progress: 0.05, title: 'Scope cards', tier: 'should' },
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 39, currentWeek: 1, totalWeeks: 6 },
  },
  {
    id: 'u2',
    pitchId: 'p1',
    posted_at: '2025-06-10T15:00:00Z',
    posted_by: 'alice',
    narrative:
      'Hill chart engine complete. Scope cards rendering but drag-to-reorder has a z-index issue we need to debug.',
    needle_snapshot: { progress: 0.5, zone: 'some_risk' },
    hill_snapshot: [
      { scopeId: 's1', hill_progress: 0.6, title: 'Hill chart engine', tier: 'must' },
      { scopeId: 's2', hill_progress: 0.05, title: 'Scope cards', tier: 'should' },
      { scopeId: 's3', hill_progress: 0.2, title: 'Timebox tape', tier: 'could' },
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 32, currentWeek: 2, totalWeeks: 6 },
    slack_attempted: true,
  },
  {
    id: 'u3',
    pitchId: 'p1',
    posted_at: '2025-06-17T14:30:00Z',
    posted_by: 'seb',
    narrative:
      'Scope map is fully wired with real-time Liveblocks data. Hill chart drag works. Ready to start on Mission Control next.',
    needle_snapshot: { progress: 0.85, zone: 'on_track' },
    // s1 over the hill, s2 slid back, s3 dropped from scope.
    hill_snapshot: [
      { scopeId: 's1', hill_progress: 0.95, title: 'Hill chart engine', tier: 'must' },
      { scopeId: 's2', hill_progress: 0.0, title: 'Scope cards', tier: 'should' },
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 25, currentWeek: 3, totalWeeks: 6 },
    slack_delivered_at: '2025-06-17T14:31:00Z',
  },
]

const cards = deriveTimelineCards(updates, users)

export const WithUpdates: Story = {
  args: { cards },
}

export const Empty: Story = {
  args: { cards: [] },
}

// The first-ever update on its own — all scopes render as "New", no prior baseline.
export const FirstUpdateOnly: Story = {
  args: {
    cards: deriveTimelineCards([updates[0]], users),
  },
}

export const SingleUpdate: Story = {
  args: { cards: [cards[0]] },
}

export const WithRetryBanner: Story = {
  args: { cards, onRetrySlack: () => {} },
}
