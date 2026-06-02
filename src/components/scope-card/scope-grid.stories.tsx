import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { ScopeGrid } from './scope-grid'
import { reorderScopes } from '@/lib/scope-engine'

const meta = {
  title: 'ScopeCard/ScopeGrid',
  component: ScopeGrid,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ScopeGrid>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_SCOPES = [
  {
    id: 's1',
    order: 1,
    title: 'Auth flow',
    tier: 'must' as const,
    color: '#3e63dd',
    litmus_text: 'Users can sign in and access their workspace',
    tasks: [
      { id: 't1', title: 'Set up auth middleware', done: true },
      { id: 't2', title: 'Add login page', done: false },
      { id: 't3', title: 'Token refresh', done: false },
    ],
  },
  {
    id: 's2',
    order: 2,
    title: 'Dashboard overview',
    tier: 'should' as const,
    color: '#3e63dd',
    litmus_text: 'Team can see all pitches at a glance',
    tasks: [
      { id: 't4', title: 'Pitch cards layout', done: true },
      { id: 't5', title: 'Needle mini display', done: true },
    ],
  },
  {
    id: 's3',
    order: 3,
    title: 'Hill chart rendering',
    tier: 'must' as const,
    color: '#3e63dd',
    litmus_text: 'Scopes visible on interactive hill chart',
    tasks: [
      { id: 't6', title: 'SVG path math', done: true },
      { id: 't7', title: 'Dot dragging', done: false },
      { id: 't8', title: 'Tooltip on hover', done: false },
    ],
  },
  {
    id: 's4',
    order: 4,
    title: 'Dark mode',
    tier: 'could' as const,
    color: '#3e63dd',
    litmus_text: 'App renders in dark theme',
    tasks: [{ id: 't9', title: 'Theme toggle', done: false }],
  },
  {
    id: 's5',
    order: 5,
    title: 'Notifications',
    tier: 'should' as const,
    color: '#3e63dd',
    litmus_text: 'Users get notified on needle changes',
    tasks: [
      { id: 't10', title: 'Slack integration', done: false },
      { id: 't11', title: 'In-app badge', done: false },
    ],
  },
  {
    id: 's6',
    order: 6,
    title: 'Timebox display',
    tier: 'must' as const,
    color: '#3e63dd',
    litmus_text: 'Pitch shows progress through timebox',
    tasks: [
      { id: 't12', title: 'Tape component', done: true },
      { id: 't13', title: 'Today marker', done: true },
      { id: 't14', title: 'Days left label', done: true },
    ],
  },
]

export const Default: Story = {
  args: { scopes: SAMPLE_SCOPES },
}

export const Interactive: Story = {
  args: { scopes: [] },
  render: () => {
    const [scopes, setScopes] = useState(SAMPLE_SCOPES)

    return (
      <ScopeGrid
        scopes={scopes}
        onReorder={(activeId, overId) => {
          setScopes((prev) => reorderScopes(prev, activeId, overId))
        }}
        onOpenScope={(scopeId) => console.log('open scope', scopeId)}
        onDeleteScope={(scopeId) => {
          setScopes((prev) => prev.filter((s) => s.id !== scopeId))
        }}
      />
    )
  },
}
