import { generateRing } from '@/lib/product-map-geometry'
import type { CycleWindow, LinkedShape } from '@/lib/product-map-engine'
import type { Area, Frame } from '@/product-map-liveblocks.config'

/**
 * Vasco's own product, drawn as land. Three top-level regions, so every rendered
 * level appears: Front office holds islands and reads as an **archipelago**, Back
 * office and Connectors hold leaves and read as **islands**, and the named
 * regions inside them are **areas**.
 *
 * Outlines are generated from a centre and a radius rather than typed out point
 * by point, because the ring an agent writes and the ring this produces are the
 * same kind of data — a closed list of points.
 */
function ring(id: string, cx: number, cy: number, r: number): [number, number][] {
  return generateRing(id, cx, cy, r).map(([x, y]) => [Math.round(x), Math.round(y)])
}

type Leaf = { id: string; name: string; parent: string; cx: number; cy: number; r: number }

const LEAVES: Leaf[] = [
  // Front office → External to Vasco
  { id: 'slack', name: 'Slack / Teams', parent: 'external', cx: 130, cy: 120, r: 42 },
  { id: 'email', name: 'Email', parent: 'external', cx: 205, cy: 130, r: 34 },
  { id: 'crm-write', name: 'CRM write-back', parent: 'external', cx: 150, cy: 205, r: 40 },
  // Front office → Owned by Vasco
  { id: 'artifacts', name: 'Shared artifacts', parent: 'owned', cx: 285, cy: 125, r: 40 },
  { id: 'dashboards', name: 'Dashboards', parent: 'owned', cx: 355, cy: 165, r: 36 },
  { id: 'fo-agents', name: 'Front office agents', parent: 'owned', cx: 290, cy: 215, r: 42 },

  // Back office
  { id: 'mcp', name: 'MCP', parent: 'back-office', cx: 545, cy: 385, r: 38 },
  { id: 'marketplace', name: 'Marketplace', parent: 'back-office', cx: 625, cy: 395, r: 36 },
  { id: 'onboarding', name: 'Onboarding', parent: 'back-office', cx: 600, cy: 465, r: 36 },
  { id: 'agent-engine', name: 'Agent engine', parent: 'back-office', cx: 520, cy: 455, r: 38 },
  { id: 'plan-engine', name: 'Plan engine', parent: 'back-office', cx: 675, cy: 460, r: 34 },
  { id: 'metric-engine', name: 'Metric engine', parent: 'back-office', cx: 610, cy: 535, r: 38 },
  { id: 'context', name: 'Context', parent: 'back-office', cx: 530, cy: 525, r: 34 },
  { id: 'foundation', name: 'Definitions', parent: 'back-office', cx: 680, cy: 530, r: 34 },

  // Connectors
  { id: 'c-crm', name: 'CRM', parent: 'connectors', cx: 870, cy: 145, r: 34 },
  { id: 'c-billing', name: 'Billing & finance', parent: 'connectors', cx: 930, cy: 195, r: 34 },
  { id: 'c-warehouse', name: 'Data warehouse', parent: 'connectors', cx: 865, cy: 215, r: 32 },
  { id: 'c-calls', name: 'Conversations', parent: 'connectors', cx: 925, cy: 265, r: 32 },
  { id: 'c-product', name: 'Product analytics', parent: 'connectors', cx: 860, cy: 290, r: 34 },
  { id: 'c-contracts', name: 'Contracts', parent: 'connectors', cx: 920, cy: 340, r: 30 },
]

export const AREAS: Area[] = [
  // An archipelago and its islands carry no outline: their coastline is the
  // merged silhouette of the leaves underneath.
  { id: 'front-office', name: 'Front office', x: 0, y: 0 },
  { id: 'external', name: 'External to Vasco', parentAreaId: 'front-office', x: 0, y: 0 },
  { id: 'owned', name: 'Owned by Vasco', parentAreaId: 'front-office', x: 1, y: 0 },
  { id: 'back-office', name: 'Back office', x: 1, y: 1, owner: 'user_ops' },
  { id: 'connectors', name: 'Connectors', x: 2, y: 0 },
  ...LEAVES.map((leaf) => ({
    id: leaf.id,
    name: leaf.name,
    parentAreaId: leaf.parent,
    x: 0,
    y: 0,
    outline: ring(leaf.id, leaf.cx, leaf.cy, leaf.r),
  })),
]

function frame(
  id: string,
  areaId: string,
  kind: Frame['kind'],
  type: Frame['type'],
  problem: string,
  options: { reports?: number; customers?: number; appetite?: string; woken?: string } = {}
): Frame {
  const internal = options.reports ?? 1
  const customers = options.customers ?? 0
  return {
    id,
    areaId,
    kind,
    type,
    problem,
    appetite: options.appetite ?? '',
    business_case: '',
    reports: [
      ...Array.from({ length: internal }, (_, i) => ({
        capturer: 'user_1',
        source: 'internal' as const,
        text: `${problem} — seen again (${i + 1})`,
        date: '2026-08-20',
      })),
      ...Array.from({ length: customers }, (_, i) => ({
        capturer: 'user_2',
        source: 'customer' as const,
        customer: ['Northwind', 'Contoso', 'Initech'][i % 3],
        text: `${problem} — raised by a customer`,
        date: '2026-08-24',
      })),
    ],
    pointers: [],
    last_woken: options.woken ?? '2026-09-01',
    resolved: false,
  }
}

export const FRAMES: Frame[] = [
  frame('f1', 'slack', 'brand_burn', 'bug', 'Capture from Slack loses the thread link', {
    reports: 3,
    customers: 4,
    appetite: 'Two weeks',
  }),
  frame('f2', 'email', 'pain_point', 'request', 'Email digests arrive at 3am in APAC', {
    customers: 2,
  }),
  frame('f3', 'crm-write', 'pain_point', 'bug', 'Write-back silently drops custom fields', {
    reports: 2,
    customers: 3,
  }),
  frame('f4', 'artifacts', 'unlock_win', 'idea', 'Share an artifact without a seat', {
    appetite: 'Six weeks',
  }),
  frame('f5', 'dashboards', 'pain_point', 'irritant', 'Dashboard filters reset on reload', {
    reports: 4,
  }),
  frame('f6', 'fo-agents', 'brand_burn', 'security', 'Agent can read another org’s context', {
    appetite: 'Whatever it takes',
  }),
  frame('f7', 'mcp', 'pain_point', 'bug', 'Batch writes drop the assignee', { reports: 2 }),
  frame('f8', 'marketplace', 'unlock_win', 'idea', 'Publish a connector without us', {}),
  frame('f9', 'onboarding', 'brand_burn', 'request', 'First run needs a warehouse before anything works', {
    customers: 5,
    appetite: 'Six weeks',
  }),
  frame('f10', 'agent-engine', 'pain_point', 'bug', 'Long runs time out with no partial result', {
    reports: 3,
  }),
  frame('f11', 'plan-engine', 'pain_point', 'irritant', 'Plan edits need a full recalculation', {}),
  frame('f12', 'metric-engine', 'brand_burn', 'bug', 'Two metrics disagree on the same month', {
    reports: 2,
    customers: 3,
  }),
  frame('f13', 'context', 'unlock_win', 'idea', 'Let the team correct the context graph', {}),
  frame('f14', 'foundation', 'pain_point', 'bug', 'Reconciliation hides which source won', {}),
  frame('f15', 'c-crm', 'pain_point', 'bug', 'Salesforce sync stalls on deleted records', {
    customers: 2,
  }),
  frame('f16', 'c-billing', 'brand_burn', 'bug', 'Stripe refunds counted as revenue', {
    reports: 2,
    customers: 4,
  }),
  frame('f17', 'c-warehouse', 'pain_point', 'request', 'Snowflake key-pair auth unsupported', {
    customers: 3,
  }),
  frame('f18', 'c-calls', 'unlock_win', 'idea', 'Mine calls for product problems', {}),
  frame('f19', 'c-product', 'pain_point', 'irritant', 'Amplitude backfill has to be manual', {}),
  // Woken long ago, so freshness has something to fade.
  frame('f20', 'c-contracts', 'pain_point', 'bug', 'Contract dates parse in the wrong locale', {
    woken: '2026-05-02',
  }),
  // No area: the Unmapped tray must have something in it.
  {
    ...frame('f21', '', 'pain_point', 'idea', 'Somebody should own the glossary', {}),
    areaId: undefined,
  },
]

export const CYCLES: CycleWindow[] = [
  { slug: 'c1', title: 'Cycle 1', type: 'build', start_date: '2026-05-04', end_date: '2026-06-12' },
  { slug: 'c2', title: 'Cycle 2', type: 'build', start_date: '2026-06-15', end_date: '2026-07-24' },
  { slug: 'c3', title: 'Cycle 3', type: 'build', start_date: '2026-07-27', end_date: '2026-09-04' },
]

export const SHAPES: LinkedShape[] = [
  {
    frameId: 'f1',
    shapeId: 's1',
    title: 'Slack capture, properly',
    stage: 'building',
    cycleSlug: 'c3',
    cycleTitle: 'Cycle 3',
    currentCycle: true,
  },
  {
    frameId: 'f9',
    shapeId: 's2',
    title: 'A first run that works empty',
    stage: 'shaping',
    cycleSlug: 'c3',
    cycleTitle: 'Cycle 3',
    currentCycle: false,
  },
]

export const TODAY = '2026-09-03'
