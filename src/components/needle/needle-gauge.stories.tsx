import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { NeedleGauge } from './needle-gauge'

const meta = {
  title: 'Needle/NeedleGauge',
  component: NeedleGauge,
  parameters: { layout: 'centered' },
  argTypes: {
    needle: { control: 'object' },
    ghost: { control: 'object' },
    timestamp: { control: 'text' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof NeedleGauge>

export default meta
type Story = StoryObj<typeof meta>

export const NullState: Story = {
  args: {
    needle: null,
  },
}

export const Concerned: Story = {
  args: {
    needle: { progress: 0.15, zone: 'concerned' },
    timestamp: 'Updated 3 days ago',
  },
}

export const SomeRisk: Story = {
  args: {
    needle: { progress: 0.5, zone: 'some_risk' },
    timestamp: 'Updated 1 day ago',
  },
}

export const OnTrack: Story = {
  args: {
    needle: { progress: 0.85, zone: 'on_track' },
    timestamp: 'Updated 2 hours ago',
  },
}

export const LowProgressOnTrack: Story = {
  name: 'Low progress + on_track (independent)',
  args: {
    needle: { progress: 0.1, zone: 'on_track' },
    timestamp: 'Just started but feeling good',
  },
}

export const HighProgressConcerned: Story = {
  name: 'High progress + concerned (independent)',
  args: {
    needle: { progress: 0.9, zone: 'concerned' },
    timestamp: 'Almost done but hitting a wall',
  },
}

export const WithGhost: Story = {
  args: {
    needle: { progress: 0.7, zone: 'on_track' },
    ghost: { progress: 0.4, zone: 'some_risk' },
    timestamp: 'Updated Tuesday',
  },
}

export const Interactive: Story = {
  args: {
    needle: { progress: 0.5, zone: 'some_risk' },
    onProgressChange: fn(),
    timestamp: 'Click the arc to move',
  },
}
