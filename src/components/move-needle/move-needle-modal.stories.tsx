import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { MoveNeedleModal } from './move-needle-modal'
import type { Zone } from '@/cycle-liveblocks.config'

const meta: Meta<typeof MoveNeedleModal> = {
  title: 'Components/MoveNeedleModal',
  component: MoveNeedleModal,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof MoveNeedleModal>

export const Default: Story = {
  args: {
    open: true,
    weekLabel: 'Week 3 of 6',
    dateLabel: 'May 27, 2025',
    userName: 'Seb',
    pitchTitle: 'Mission Control',
    tasksDone: 9,
    tasksTotal: 13,
    daysLeft: 21,
    onOpenChange: () => {},
    onPost: () => {},
  },
}

export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    const [lastPost, setLastPost] = useState<{
      zone: Zone
      narrative: string
    } | null>(null)

    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border rounded-full px-4 py-1.5"
        >
          Move the needle
        </button>
        <MoveNeedleModal
          open={open}
          onOpenChange={setOpen}
          weekLabel="Week 3 of 6"
          dateLabel="May 27, 2025"
          userName="Seb"
          pitchTitle="Mission Control"
          tasksDone={9}
          tasksTotal={13}
          daysLeft={21}
          onPost={async (zone, narrative) => {
            await new Promise((r) => setTimeout(r, 800))
            setLastPost({ zone, narrative })
          }}
        />
        {lastPost && (
          <div className="text-xs font-mono p-3 rounded border bg-muted max-w-xs">
            <div>Zone: {lastPost.zone}</div>
            <div>Narrative: {lastPost.narrative}</div>
          </div>
        )}
      </div>
    )
  },
}
