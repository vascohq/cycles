import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
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
    color: '#3e63dd',
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
    color: '#3e63dd',
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
    color: '#3e63dd',
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
    color: '#3e63dd',
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
    color: '#3e63dd',
    litmus_text: 'No tasks yet',
    tasks: [],
  },
}

const CLUSTER_ORG_USERS = [
  { userId: 'u_simon', name: 'Simon', initials: 'SI', hasImage: false, imageUrl: '' },
  { userId: 'u_marie', name: 'Marie', initials: 'MA', hasImage: false, imageUrl: '' },
  { userId: 'u_emile', name: 'Emile', initials: 'EM', hasImage: false, imageUrl: '' },
  { userId: 'u_seb', name: 'Seb', initials: 'SE', hasImage: false, imageUrl: '' },
]

// Deduped assignee cluster: Simon + Marie + Emile + Seb across tasks (cap 3 →
// "+1"), plus a former member (u_gone) who has left the org.
export const WithAssignees: Story = {
  args: {
    id: 's8',
    order: 2,
    title: 'Stripe checkout wiring',
    tier: 'must',
    color: '#f5a524',
    litmus_text: 'A trial user can self-upgrade to a paying plan',
    orgUsers: CLUSTER_ORG_USERS,
    tasks: [
      { id: 't1', title: 'Port products', done: true, assigneeId: 'u_simon' },
      { id: 't2', title: 'Switch secrets', done: false, assigneeId: 'u_marie' },
      { id: 't3', title: 'Enable guard', done: false, assigneeId: 'u_emile' },
      { id: 't4', title: 'Provision tiers', done: false, assigneeId: 'u_seb' },
      { id: 't5', title: 'Confirm webhooks', done: false, assigneeId: 'u_gone' },
    ],
  },
}

export const ReadOnly: Story = {
  args: {
    id: 's7',
    order: 1,
    title: 'Auth flow',
    tier: 'must',
    color: '#3e63dd',
    litmus_text: 'Users can sign in and access their workspace',
    tasks: SAMPLE_TASKS,
    readOnly: true,
  },
}

export const NoLitmus: Story = {
  args: {
    id: 's6',
    order: 5,
    title: 'Scope without litmus',
    tier: 'could',
    color: '#3e63dd',
    litmus_text: '',
    tasks: [{ id: 't1', title: 'Some task', done: false }],
  },
}

export const WithActions: Story = {
  args: {
    id: 's8',
    order: 1,
    title: 'Editable scope',
    tier: 'must',
    color: '#3e63dd',
    litmus_text: 'Users can edit and delete this scope',
    tasks: SAMPLE_TASKS,
    onOpen: fn(),
    onDelete: fn(),
  },
}

export const ActionsReadOnly: Story = {
  args: {
    id: 's9',
    order: 1,
    title: 'Locked scope',
    tier: 'must',
    color: '#3e63dd',
    litmus_text: 'This scope is done — no actions menu',
    tasks: SAMPLE_TASKS,
    onOpen: fn(),
    onDelete: fn(),
    readOnly: true,
  },
}
