import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { HillHistory } from './hill-history'
import type { HillScope } from './hill-chart'
import { buildHillHistoryFrames } from '@/lib/scope-map-helpers'
import { diffHillTrail } from '@/lib/hill-trail-engine'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

const meta = {
  title: 'HillChart/HillHistory',
  component: HillHistory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HillHistory>

export default meta
type Story = StoryObj<typeof meta>

// Live (latest) positions.
const LIVE_SCOPES: HillScope[] = [
  { id: '1', title: 'Auth flow', tier: 'must', color: '#e5484d', hill_progress: 0.85, order: 1 },
  { id: '2', title: 'Dashboard', tier: 'must', color: '#e5484d', hill_progress: 0.6, order: 2 },
  { id: '3', title: 'Notifications', tier: 'should', color: '#30a46c', hill_progress: 0.4, order: 3 },
]

// Three posted updates over the cycle. Snapshots carry title/tier so historical
// frames render proper dots without the live scope list.
function snap(
  scopeId: string,
  hill_progress: number,
  title: string,
  tier: 'must' | 'should' | 'could'
) {
  return { scopeId, hill_progress, title, tier }
}

const UPDATES: PitchUpdate[] = [
  {
    id: 'u1',
    pitchId: 'p',
    posted_at: '2025-06-03T14:30:00Z',
    posted_by: 'bob',
    narrative: 'Kickoff.',
    needle_snapshot: { progress: 0.2, zone: 'concerned' },
    hill_snapshot: [
      snap('1', 0.1, 'Auth flow', 'must'),
      snap('2', 0.05, 'Dashboard', 'must'),
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 30, currentWeek: 1, totalWeeks: 6 },
  },
  {
    id: 'u2',
    pitchId: 'p',
    posted_at: '2025-06-10T15:00:00Z',
    posted_by: 'alice',
    narrative: 'Auth over the hill, notifications added.',
    needle_snapshot: { progress: 0.5, zone: 'some_risk' },
    hill_snapshot: [
      snap('1', 0.55, 'Auth flow', 'must'),
      snap('2', 0.3, 'Dashboard', 'must'),
      snap('3', 0.15, 'Notifications', 'should'),
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 23, currentWeek: 2, totalWeeks: 6 },
  },
  {
    id: 'u3',
    pitchId: 'p',
    posted_at: '2025-06-17T14:30:00Z',
    posted_by: 'seb',
    narrative: 'Steady progress across the board.',
    needle_snapshot: { progress: 0.7, zone: 'on_track' },
    hill_snapshot: [
      snap('1', 0.8, 'Auth flow', 'must'),
      snap('2', 0.5, 'Dashboard', 'must'),
      snap('3', 0.3, 'Notifications', 'should'),
    ],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 16, currentWeek: 3, totalWeeks: 6 },
  },
]

const USERS = new Map([
  ['bob', { name: 'Bob' }],
  ['alice', { name: 'Alice' }],
  ['seb', { name: 'Seb' }],
])

const HISTORY = buildHillHistoryFrames(UPDATES, LIVE_SCOPES, USERS)

// Live trail: latest snapshot (u3) vs current live positions.
const LIVE_TRAILS = diffHillTrail(
  UPDATES[2].hill_snapshot,
  LIVE_SCOPES.map((s) => ({ id: s.id, hill_progress: s.hill_progress }))
)

// Default: opens on the live frame. Arrows step back through updates.
export const Default: Story = {
  args: {
    scopes: LIVE_SCOPES,
    trails: LIVE_TRAILS,
    history: HISTORY,
    onHillProgressChange: () => {},
  },
  render: (args) => (
    <div className="w-[520px]">
      <HillHistory {...args} />
    </div>
  ),
}

// No history yet — the frame is live and the arrows are disabled.
export const LiveOnly: Story = {
  args: {
    scopes: LIVE_SCOPES,
    trails: [],
    history: [],
    onHillProgressChange: () => {},
  },
  render: (args) => (
    <div className="w-[520px]">
      <HillHistory {...args} />
    </div>
  ),
}

// Steps back one update via the "Older update" arrow, then asserts the frame is
// historical: the date + author label shows and dragging is disabled (the dot
// group carries the read-only "default" cursor instead of "grab").
export const StepIntoHistory: Story = {
  args: {
    scopes: LIVE_SCOPES,
    trails: LIVE_TRAILS,
    history: HISTORY,
    onHillProgressChange: () => {},
  },
  render: (args) => (
    <div className="w-[520px]">
      <HillHistory {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Starts live, draggable.
    await expect(canvas.getByText('Live')).toBeInTheDocument()
    const liveDot = canvasElement.querySelector('[data-scope-dot]') as HTMLElement
    await expect(liveDot.style.cursor).toBe('grab')

    // Step back to the newest historical update (u3 — Seb).
    await userEvent.click(canvas.getByRole('button', { name: 'Older update' }))

    await expect(canvas.getByText('Jun 17, 2025')).toBeInTheDocument()
    await expect(canvas.getByText(/Seb/)).toBeInTheDocument()

    // Historical frame is read-only — dot is no longer grabbable.
    const histDot = canvasElement.querySelector('[data-scope-dot]') as HTMLElement
    await expect(histDot.style.cursor).toBe('default')

    // Return to live re-enables editing.
    await userEvent.click(canvas.getByRole('button', { name: 'Newer update' }))
    await expect(canvas.getByText('Live')).toBeInTheDocument()
    const backDot = canvasElement.querySelector('[data-scope-dot]') as HTMLElement
    await expect(backDot.style.cursor).toBe('grab')
  },
}

// Interactive playground mirroring the wired scope-map: live frame is editable,
// historical frames are read-only snapshots with trails.
export const Interactive: Story = {
  args: { scopes: [], history: [] },
  render: () => {
    const [scopes, setScopes] = useState<HillScope[]>(LIVE_SCOPES)
    const [highlighted, setHighlighted] = useState<string | null>(null)
    return (
      <div className="w-[520px]">
        <HillHistory
          scopes={scopes}
          trails={LIVE_TRAILS}
          history={HISTORY}
          highlightedScopeId={highlighted}
          onScopeHover={setHighlighted}
          onHillProgressChange={(scopeId, progress) =>
            setScopes((prev) =>
              prev.map((s) =>
                s.id === scopeId ? { ...s, hill_progress: progress } : s
              )
            )
          }
        />
      </div>
    )
  },
}
