import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { HillChart, type HillScope } from './hill-chart'

const meta = {
  title: 'HillChart/HillChart',
  component: HillChart,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HillChart>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_SCOPES: HillScope[] = [
  { id: '1', title: 'Auth flow', tier: 'must', hill_progress: 0.15, order: 1 },
  { id: '2', title: 'Dashboard', tier: 'must', hill_progress: 0.4, order: 2 },
  { id: '3', title: 'Notifications', tier: 'should', hill_progress: 0.6, order: 3 },
  { id: '4', title: 'Dark mode', tier: 'could', hill_progress: 0.85, order: 4 },
]

export const Default: Story = {
  args: {
    scopes: SAMPLE_SCOPES,
  },
}

export const Empty: Story = {
  args: {
    scopes: [],
  },
}

export const SingleScope: Story = {
  args: {
    scopes: [
      { id: '1', title: 'Only scope', tier: 'must', hill_progress: 0.5, order: 1 },
    ],
  },
}

export const AllAtStart: Story = {
  args: {
    scopes: [
      { id: '1', title: 'Scope A', tier: 'must', hill_progress: 0.05, order: 1 },
      { id: '2', title: 'Scope B', tier: 'should', hill_progress: 0.1, order: 2 },
      { id: '3', title: 'Scope C', tier: 'could', hill_progress: 0.15, order: 3 },
    ],
  },
}

export const AllDone: Story = {
  args: {
    scopes: [
      { id: '1', title: 'Scope A', tier: 'must', hill_progress: 0.9, order: 1 },
      { id: '2', title: 'Scope B', tier: 'should', hill_progress: 0.92, order: 2 },
      { id: '3', title: 'Scope C', tier: 'could', hill_progress: 0.95, order: 3 },
    ],
  },
}

export const WithTrails: Story = {
  args: {
    scopes: SAMPLE_SCOPES,
    trails: [
      // advanced forward — long rightward trail
      { scopeId: '1', state: 'moved', fromProgress: 0.05, toProgress: 0.15, stepDelta: 1, label: 'Nudged forward' },
      // slid back — leftward trail, neutral color (no alarm)
      { scopeId: '2', state: 'moved', fromProgress: 0.6, toProgress: 0.4, stepDelta: -3, label: 'Slid back' },
      // didn't move — no trail rendered
      { scopeId: '3', state: 'stagnant', fromProgress: 0.6, toProgress: 0.6, stepDelta: 0, label: "Didn't move" },
      // crept over the crest
      { scopeId: '4', state: 'moved', fromProgress: 0.5, toProgress: 0.85, stepDelta: 5, label: 'Over the hill' },
    ],
  },
}

export const NewAndDropped: Story = {
  args: {
    scopes: SAMPLE_SCOPES,
    trails: [
      // new scope — dashed halo, no trail (absent from last snapshot)
      { scopeId: '4', state: 'new', toProgress: 0.85, label: 'New' },
      // moved scope alongside
      { scopeId: '1', state: 'moved', fromProgress: 0.05, toProgress: 0.15, stepDelta: 1, label: 'Nudged forward' },
      // dropped scope — lone named ghost, no live dot
      { scopeId: 'gone', state: 'dropped', fromProgress: 0.7, title: 'Cut feature', tier: 'should', label: 'Dropped' },
    ],
  },
}

export const Highlighted: Story = {
  args: {
    scopes: SAMPLE_SCOPES,
    highlightedScopeId: '2',
  },
}

export const Interactive: Story = {
  args: { scopes: [] },
  render: () => {
    const [scopes, setScopes] = useState<HillScope[]>(SAMPLE_SCOPES)
    const [highlighted, setHighlighted] = useState<string | null>(null)

    return (
      <div className="w-[500px]">
        <HillChart
          scopes={scopes}
          highlightedScopeId={highlighted}
          onScopeHover={setHighlighted}
          onHillProgressChange={(scopeId, progress) => {
            setScopes((prev) =>
              prev.map((s) =>
                s.id === scopeId ? { ...s, hill_progress: progress } : s
              )
            )
          }}
        />
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          {scopes.map((s) => (
            <div key={s.id} className={highlighted === s.id ? 'font-bold' : ''}>
              {s.order}. {s.title}: {(s.hill_progress * 100).toFixed(0)}%
            </div>
          ))}
        </div>
      </div>
    )
  },
}
