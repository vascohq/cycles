import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ScopeCard } from './scope-card'

const meta = {
  title: 'ScopeCard/ScopeCard',
  component: ScopeCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScopeCard>

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_TASKS = [
  { id: 't1', title: 'Set up auth middleware', done: true },
  { id: 't2', title: 'Add login page', done: true },
  { id: 't3', title: 'Implement token refresh', done: false },
  { id: 't4', title: 'Write integration tests', done: false },
]

export const Must: Story = {
  args: {
    id: 's1',
    order: 1,
    title: 'Auth flow',
    tier: 'must',
    litmus_text: 'Users can sign in and access their workspace',
    tasks: SAMPLE_TASKS,
  },
}

export const Should: Story = {
  args: {
    id: 's2',
    order: 2,
    title: 'Dashboard overview',
    tier: 'should',
    litmus_text: 'Team can see all pitches at a glance',
    tasks: [
      { id: 't1', title: 'Pitch cards layout', done: false },
      { id: 't2', title: 'Needle mini display', done: false },
    ],
  },
}

export const Could: Story = {
  args: {
    id: 's3',
    order: 3,
    title: 'Dark mode',
    tier: 'could',
    litmus_text: 'App renders properly in dark theme',
    tasks: [{ id: 't1', title: 'Theme toggle', done: false }],
  },
}

export const AllDone: Story = {
  args: {
    id: 's4',
    order: 1,
    title: 'Completed scope',
    tier: 'must',
    litmus_text: 'Everything is shipped',
    tasks: [
      { id: 't1', title: 'Task one', done: true },
      { id: 't2', title: 'Task two', done: true },
      { id: 't3', title: 'Task three', done: true },
    ],
  },
}

export const NoTasks: Story = {
  args: {
    id: 's5',
    order: 4,
    title: 'Empty scope',
    tier: 'should',
    litmus_text: 'No tasks yet',
    tasks: [],
  },
}

export const NoLitmus: Story = {
  args: {
    id: 's6',
    order: 5,
    title: 'Scope without litmus',
    tier: 'could',
    litmus_text: '',
    tasks: [{ id: 't1', title: 'Some task', done: false }],
  },
}
