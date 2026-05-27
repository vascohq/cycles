import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { ParkingLot, type ParkingLotItem } from './parking-lot'

const meta = {
  title: 'ParkingLot/ParkingLot',
  component: ParkingLot,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParkingLot>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_ITEMS: ParkingLotItem[] = [
  { id: 'p1', text: 'Do we need SSO for v1 or can we ship with email-only?', resolved: false },
  { id: 'p2', text: 'Which Slack workspace do updates post to — org-wide or per-team?', resolved: false },
  { id: 'p3', text: 'Should the hill chart auto-save on drag or require explicit save?', resolved: true },
  { id: 'p4', text: 'How do we handle pitches that span two cycles?', resolved: false },
  { id: 'p5', text: 'Is the parking lot visible to viewers or only editors?', resolved: true },
]

export const WithItems: Story = {
  args: { items: SAMPLE_ITEMS },
}

export const AllResolved: Story = {
  args: {
    items: SAMPLE_ITEMS.map((i) => ({ ...i, resolved: true })),
  },
}

export const Empty: Story = {
  args: { items: [] },
}

export const SingleItem: Story = {
  args: {
    items: [{ id: 'p1', text: 'Should we use WebSockets or SSE for real-time updates?', resolved: false }],
  },
}

export const Interactive: Story = {
  args: { items: [] },
  render: () => {
    const [items, setItems] = useState(SAMPLE_ITEMS)
    return (
      <ParkingLot
        items={items}
        onToggleResolved={(id, resolved) => {
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, resolved } : i))
          )
        }}
      />
    )
  },
}
