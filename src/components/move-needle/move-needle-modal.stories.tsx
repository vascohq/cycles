import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { MoveNeedleModal } from './move-needle-modal'
import type { Zone } from '@/cycle-liveblocks.config'
import type { HillScope } from '@/components/hill-chart'
import { diffHillTrail, noChangeStreaks, summarizeMovement } from '@/lib/hill-trail-engine'
import type { HillSnapshot } from '@/cycle-liveblocks.config'

// A snapshot from the last update, then the live scopes now — fed through the
// shared Hill Trail engine so the story exercises the real diff, not a mock.
const previousSnapshot: HillSnapshot[] = [
  { scopeId: 's1', hill_progress: 0.21, title: 'Auth flow', tier: 'must' },
  { scopeId: 's2', hill_progress: 0.5, title: 'Billing', tier: 'should' },
  { scopeId: 's3', hill_progress: 0.43, title: 'Onboarding', tier: 'could' },
  { scopeId: 's4', hill_progress: 0.71, title: 'Dropped item', tier: 'should' },
]

const hillScopes: HillScope[] = [
  { id: 's1', title: 'Auth flow', tier: 'must', hill_progress: 0.57, order: 1 },
  { id: 's2', title: 'Billing', tier: 'should', hill_progress: 0.5, order: 2 },
  { id: 's3', title: 'Onboarding', tier: 'could', hill_progress: 0.64, order: 3 },
  { id: 's5', title: 'New scope', tier: 'must', hill_progress: 0.14, order: 4 },
]

const hillTrails = diffHillTrail(previousSnapshot, hillScopes)
const movementPreview = summarizeMovement(
  hillTrails,
  noChangeStreaks([previousSnapshot], hillScopes),
  new Map(hillScopes.map((s) => [s.id, s.title]))
)

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
    daysLeft: 21,
    currentProgress: 0.5,
    currentZone: 'some_risk',
    previousZone: 'on_track',
    onOpenChange: () => {},
    onPost: () => {},
  },
}

export const WithHillDiff: Story = {
  args: {
    open: true,
    weekLabel: 'Week 3 of 6',
    dateLabel: 'May 27, 2025',
    userName: 'Seb',
    pitchTitle: 'Mission Control',
    daysLeft: 21,
    currentProgress: 0.5,
    currentZone: 'some_risk',
    previousZone: 'on_track',
    movementPreview,
    hillScopes,
    hillTrails,
    onOpenChange: () => {},
    onPost: () => {},
  },
}

export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    const [lastPost, setLastPost] = useState<{
      progress: number
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
          daysLeft={21}
          currentProgress={0.5}
          currentZone={null}
          onPost={async (progress, zone, narrative) => {
            await new Promise((r) => setTimeout(r, 800))
            setLastPost({ progress, zone, narrative })
          }}
        />
        {lastPost && (
          <div className="text-xs font-mono p-3 rounded border bg-muted max-w-xs">
            <div>Progress: {lastPost.progress.toFixed(2)}</div>
            <div>Zone: {lastPost.zone}</div>
            <div>Narrative: {lastPost.narrative}</div>
          </div>
        )}
      </div>
    )
  },
}
