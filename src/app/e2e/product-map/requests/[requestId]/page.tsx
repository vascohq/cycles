'use client'

import { useParams } from 'next/navigation'

import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { RequestLayout } from '@/app/[slug]/product/requests/[requestId]/request-page'
import type { ProductRequest } from '@/product-map-liveblocks.config'

import { AREAS, CYCLES, REQUESTS, SHAPES, USERS } from '../../fixture'


// One request with a full record, so the page has every section to draw. Kept
// here, not in the shared fixture, because the map spec reads that one.
const F1: Partial<ProductRequest> = {
  owner: 'user_1',
  raised_by: 'Jane at Northwind',
  related_request_ids: ['f2'],
  business_case: [
    '**Context:** most reports reach the map from Slack.',
    '**Problem:** without the thread, nobody can read the conversation.',
    '',
    '**How to reproduce**',
    '1. Capture a report from a Slack message.',
    '2. Open the request. The report has no `permalink`.',
    '',
    'See [the capture guide](https://example.test/capture).',
  ].join('\n'),
  outcomes: [{ id: 'o1', text: 'A report captured from Slack always opens the thread it came from.' }],
  announcement:
    'Every report you capture from Slack now links back to its thread. Open a request and you are one click from the conversation.',
  pointers: [{ kind: 'issue', label: 'Slack capture drops the permalink', url: 'https://example.test/issue/1' }],
  brief: {
    headline: 'The fix is being built this cycle.',
    where_we_are: 'Slack capture, properly is building in Cycle 3. Four customers reported it.',
    next_step: 'Link the pull request.',
    next_step_owner: 'user_1',
    watch: 'No outcome covers thread replies.',
    written_by: 'paulo',
    written_on: '2026-09-02',
  },
}
const REQUESTS_WITH_RECORD = REQUESTS.map((f) => (f.id === 'f1' ? { ...f, ...F1 } : f))
const SHAPES_WITH_SQUAD = SHAPES.map((s) =>
  s.shapeId === 's1'
    ? { ...s, squad: { name: 'Capture squad', color: '#8e4ec6' }, notionUrl: 'https://notion.test/pitch' }
    : s
)

/** The request page against fixture data. No Liveblocks, no Clerk, no editing. */
export default function RequestPageE2E() {
  const { requestId } = useParams<{ requestId: string }>()
  return (
    <OrganizationUsersProvider organizationUsers={USERS}>
      <RequestLayout
        requestId={requestId}
        requests={REQUESTS_WITH_RECORD}
        areas={AREAS}
        cycles={CYCLES}
        shapes={SHAPES_WITH_SQUAD}
      />
    </OrganizationUsersProvider>
  )
}
