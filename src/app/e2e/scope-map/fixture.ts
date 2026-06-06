import type { ScopeMapViewProps } from '@/components/scope-map'

export const FIXTURE: Omit<
  ScopeMapViewProps,
  | 'onStageChange'
  | 'onNeedleProgressChange'
  | 'onHillProgressChange'
  | 'onTaskToggle'
  | 'onAddScope'
  | 'onEditScope'
  | 'onDeleteScope'
  | 'onScopeReorder'
  | 'onScopeReset'
  | 'onParkingToggle'
> = {
  slug: 'vasco',
  cycleSlug: 'cycle-34',
  cycleTitle: 'Cycle 34',
  today: '2026-06-10',
  ghost: { progress: 0.45, zone: 'some_risk' },
  cyclePitches: [
    { title: 'Mission Control', emoji: '🛰️', href: '/e2e/scope-map', current: true },
    { title: 'Onboarding revamp', emoji: '🚀', href: '/e2e/scope-map', current: false },
    { title: 'Billing self-serve', emoji: '💳', href: '/e2e/scope-map', current: false },
  ],
  squads: [
    { id: 'sq-platform', name: 'Platform', color: '#3e63dd' },
    { id: 'sq-growth', name: 'Growth', color: '#e5484d' },
    { id: 'sq-design', name: 'Design', color: '#8e4ec6' },
  ],
  currentSquadId: 'sq-platform',
  squadPitchCounts: { 'sq-platform': 3, 'sq-growth': 2, 'sq-design': 1 },
  pitch: {
    id: 'mission-control',
    title: 'Mission Control',
    stage: 'building',
    needle: { progress: 0.65, zone: 'on_track' },
    frame_problem:
      'Teams lack visibility into cycle progress. Weekly check-ins are meetings, not artifacts. No shared surface for tracking how pitches are going.',
    frame_outcome:
      'A self-updating dashboard where leadership and ICs see every pitch needle, hill chart, and scope status at a glance — no meetings needed.',
    timebox_start: '2026-05-26',
    timebox_end: '2026-07-03',
    emoji: '🚀',
    notion_url: 'https://www.notion.so/Mission-Control-abc123',
  },
  hillScopes: [
    { id: 'scope-needle', title: 'Needle engine & gauge', tier: 'must', color: '#e5484d', hill_progress: 0.85, order: 1, isCore: true },
    { id: 'scope-hill', title: 'Hill chart visualization', tier: 'must', color: '#e5484d', hill_progress: 0.7, order: 2 },
    { id: 'scope-timebox', title: 'Timebox tape', tier: 'should', color: '#30a46c', hill_progress: 0.55, order: 3 },
    { id: 'scope-cards', title: 'Scope cards & task checklists', tier: 'must', color: '#e5484d', hill_progress: 0.4, order: 4 },
    { id: 'scope-parking', title: 'Parking lot', tier: 'could', color: '#8e4ec6', hill_progress: 0.3, order: 5 },
  ],
  scopeGridItems: [
    {
      id: 'scope-needle',
      order: 1,
      title: 'Needle engine & gauge',
      tier: 'must',
      color: '#3e63dd',
      litmus_text: 'Teams can see and update their pitch sentiment',
      isCore: true,
      done: false,
      tasks: [
        { id: 't1', title: 'Needle engine pure functions', done: true },
        { id: 't2', title: 'NeedleGauge component', done: true },
        { id: 't3', title: 'MiniNeedle for cards', done: true },
      ],
    },
    {
      id: 'scope-hill',
      order: 2,
      title: 'Hill chart visualization',
      tier: 'must',
      color: '#3e63dd',
      litmus_text: 'Scope progress visible on a hill curve',
      isCore: false,
      done: false,
      tasks: [
        { id: 't4', title: 'Hill engine math', done: true },
        { id: 't5', title: 'HillChart SVG component', done: true },
        { id: 't6', title: 'Drag-to-update dots', done: false },
      ],
    },
    {
      id: 'scope-timebox',
      order: 3,
      title: 'Timebox tape',
      tier: 'should',
      color: '#3e63dd',
      litmus_text: 'Visual countdown shows time remaining',
      isCore: false,
      done: false,
      tasks: [
        { id: 't7', title: 'Timebox engine', done: true },
        { id: 't8', title: 'TimeboxTape SVG', done: true },
      ],
    },
    {
      id: 'scope-cards',
      order: 4,
      title: 'Scope cards & task checklists',
      tier: 'must',
      color: '#3e63dd',
      litmus_text: 'Teams can break scopes into tasks and check them off',
      isCore: false,
      done: false,
      tasks: [
        { id: 't9', title: 'ScopeCard component', done: true },
        { id: 't10', title: 'ScopeGrid with DnD', done: false },
        { id: 't11', title: 'Task toggle callbacks', done: false },
      ],
    },
    {
      id: 'scope-parking',
      order: 5,
      title: 'Parking lot',
      tier: 'could',
      color: '#3e63dd',
      litmus_text: 'Open decisions have a home outside of scopes',
      isCore: false,
      done: false,
      tasks: [
        { id: 't12', title: 'ParkingLot component', done: true },
        { id: 't13', title: 'Resolve toggle', done: false },
      ],
    },
  ],
  parkingLotItems: [
    { id: 'pk1', text: 'Should updates auto-post to Slack or require confirmation?', resolved: false },
    { id: 'pk2', text: 'Do we need a mobile-responsive scope map?', resolved: true },
    { id: 'pk3', text: 'Which Slack bot token approach (webhook vs app)?', resolved: false },
  ],
}
