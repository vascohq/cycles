import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { UpdatesTimeline } from './updates-timeline'
import type { TimelineCard } from '@/lib/timeline-helpers'

const meta: Meta<typeof UpdatesTimeline> = {
  title: 'Components/UpdatesTimeline',
  component: UpdatesTimeline,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof UpdatesTimeline>

const cards: TimelineCard[] = [
  {
    id: 'u3',
    authorName: 'Seb',
    authorInitials: 'S',
    postedAt: '2025-06-17T14:30:00Z',
    formattedTimestamp: 'Tue Jun 17 · 2:30 PM',
    narrative:
      'Scope map is fully wired with real-time Liveblocks data. Hill chart drag works. Task toggles persist. Ready to start on Mission Control page next.',
    needleSnapshot: { progress: 0.85, zone: 'on_track' },
    scopesMoved: 3,
  },
  {
    id: 'u2',
    authorName: 'Alice',
    authorInitials: 'A',
    postedAt: '2025-06-10T15:00:00Z',
    formattedTimestamp: 'Tue Jun 10 · 3:00 PM',
    narrative:
      'Hill chart engine complete. Scope cards rendering but drag-to-reorder has a z-index issue we need to debug. Timebox tape looks great in compact mode.',
    needleSnapshot: { progress: 0.5, zone: 'some_risk' },
    scopesMoved: 2,
  },
  {
    id: 'u1',
    authorName: 'Bob',
    authorInitials: 'B',
    postedAt: '2025-06-03T14:30:00Z',
    formattedTimestamp: 'Tue Jun 3 · 2:30 PM',
    narrative:
      'Kicked off the cycle. Needle engine and gauge are done. Starting hill chart work this week.',
    needleSnapshot: { progress: 0.2, zone: 'concerned' },
    scopesMoved: 0,
  },
]

export const WithUpdates: Story = {
  args: {
    cards,
    channelName: 'product-general',
  },
}

export const Empty: Story = {
  args: {
    cards: [],
    channelName: 'product-general',
  },
}

export const SingleUpdate: Story = {
  args: {
    cards: [cards[0]],
    channelName: 'eng-team',
  },
}
