import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MiniNeedle } from './mini-needle'

const meta = {
  title: 'Needle/MiniNeedle',
  component: MiniNeedle,
  parameters: { layout: 'centered' },
  argTypes: {
    needle: { control: 'object' },
  },
} satisfies Meta<typeof MiniNeedle>

export default meta
type Story = StoryObj<typeof meta>

export const NullState: Story = {
  args: { needle: null },
}

export const Concerned: Story = {
  args: { needle: { progress: 0.2, zone: 'concerned' } },
}

export const SomeRisk: Story = {
  args: { needle: { progress: 0.5, zone: 'some_risk' } },
}

export const OnTrack: Story = {
  args: { needle: { progress: 0.85, zone: 'on_track' } },
}

export const AllStates: Story = {
  args: { needle: null },
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col items-center gap-1">
        <MiniNeedle needle={null} />
        <span className="text-xs text-muted-foreground">Not set</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MiniNeedle needle={{ progress: 0.2, zone: 'concerned' }} />
        <span className="text-xs text-muted-foreground">Concerned</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MiniNeedle needle={{ progress: 0.5, zone: 'some_risk' }} />
        <span className="text-xs text-muted-foreground">Some risk</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MiniNeedle needle={{ progress: 0.85, zone: 'on_track' }} />
        <span className="text-xs text-muted-foreground">On track</span>
      </div>
    </div>
  ),
}
