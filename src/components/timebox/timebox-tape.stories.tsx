import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { TimeboxTape } from './timebox-tape'

const meta = {
  title: 'Timebox/TimeboxTape',
  component: TimeboxTape,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof TimeboxTape>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-06-18',
  },
}

export const EarlyDays: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-06-03',
  },
}

export const NearEnd: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-07-10',
  },
}

export const BeforeStart: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-05-25',
  },
}

export const AfterEnd: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-07-20',
  },
}

export const Compact: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-06-18',
    compact: true,
  },
}

export const CompactBeforeStart: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-05-25',
    compact: true,
  },
}

export const Done: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-06-18',
    done: true,
  },
}

export const AllVariants: Story = {
  args: {
    start: '2026-06-01',
    end: '2026-07-13',
    today: '2026-06-18',
  },
  render: () => (
    <div className="flex flex-col gap-6 w-[500px]">
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Full — Active</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-06-18" />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Full — Before start</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-05-25" />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Full — After end</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-07-20" />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Compact — Active</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-06-18" compact />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Compact — Before start</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-05-25" compact />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mb-1 block">Full — Done (forced 100%)</span>
        <TimeboxTape start="2026-06-01" end="2026-07-13" today="2026-06-18" done />
      </div>
    </div>
  ),
}
