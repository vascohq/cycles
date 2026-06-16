import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { ScopeDrawer } from './scope-drawer'

const meta = {
  title: 'ScopeCard/ScopeDrawer',
  component: ScopeDrawer,
} satisfies Meta<typeof ScopeDrawer>

export default meta
type Story = StoryObj<typeof meta>

const baseScope = {
  id: 's1',
  order: 1,
  title: 'Stripe checkout wiring',
  tier: 'must' as const,
  color: '#f5a524',
  litmus_text:
    'A trial user can pick a plan and become a paying customer without touching sales or CS.',
}

const ORG_USERS = [
  { userId: 'u_simon', name: 'Simon', email: 'simon@vasco.app', initials: 'SI', hasImage: false, imageUrl: '' },
  { userId: 'u_marie', name: 'Marie', email: 'marie@vasco.app', initials: 'MA', hasImage: false, imageUrl: '' },
  { userId: 'u_emile', name: 'Emile', email: 'emile@vasco.app', initials: 'EM', hasImage: false, imageUrl: '' },
]

const baseHandlers = {
  open: true,
  onOpenChange: fn(),
  onEditScope: fn(),
  onToggleCore: fn(),
  onTaskToggle: fn(),
  onTaskEdit: fn(),
  onTaskDelete: fn(),
  onTaskAssign: fn(),
  onTaskReorder: fn(),
  onAddTask: fn(),
  orgUsers: ORG_USERS,
}

// The case Emile reported: a long task title used to clip with "…". It should
// now wrap to full text in the drawer read view.
export const LongTaskTitles: Story = {
  args: {
    ...baseHandlers,
    scope: {
      ...baseScope,
      tasks: [
        {
          id: 't1',
          title: 'Port products from test account to real account',
          done: false,
          assigneeId: 'u_marie',
        },
        {
          id: 't2',
          title:
            'Switch Stripe API and Webhook secrets to real account credentials in production env',
          done: false,
        },
        {
          id: 't3',
          title:
            'BE/Simon - Enable checkout isPublic guard + provision the new plan tiers end to end so a trial can self-upgrade',
          done: true,
          assigneeId: 'u_simon',
        },
        {
          id: 't4',
          title: 'Confirm webhooks fire (assignee since left the org)',
          done: false,
          assigneeId: 'u_gone',
        },
      ],
    },
  },
}

export const ShortTasks: Story = {
  args: {
    ...baseHandlers,
    scope: {
      ...baseScope,
      tasks: [
        { id: 't1', title: 'Login page', done: true },
        { id: 't2', title: 'Token refresh', done: false },
      ],
    },
  },
}
