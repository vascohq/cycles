'use client'

import { useParams } from 'next/navigation'

import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { FrameLayout } from '@/app/[slug]/product/frames/[frameId]/frame-page'
import type { Frame } from '@/product-map-liveblocks.config'

import { AREAS, CYCLES, FRAMES, SHAPES, USERS } from '../../fixture'


// One frame with a full record, so the page has every section to draw. Kept
// here, not in the shared fixture, because the map spec reads that one.
const F1: Partial<Frame> = {
  owner: 'user_1',
  business_case: 'Most reports reach the map from Slack. Without the thread, nobody can read the conversation.',
  outcomes: [{ id: 'o1', text: 'A report captured from Slack always opens the thread it came from.' }],
  announcement:
    'Every report you capture from Slack now links back to its thread. Open a frame and you are one click from the conversation.',
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
const FRAMES_WITH_RECORD = FRAMES.map((f) => (f.id === 'f1' ? { ...f, ...F1 } : f))
const SHAPES_WITH_SQUAD = SHAPES.map((s) =>
  s.shapeId === 's1'
    ? { ...s, squad: { name: 'Capture squad', color: '#8e4ec6' }, notionUrl: 'https://notion.test/pitch' }
    : s
)

/** The frame page against fixture data. No Liveblocks, no Clerk, no editing. */
export default function FramePageE2E() {
  const { frameId } = useParams<{ frameId: string }>()
  return (
    <OrganizationUsersProvider organizationUsers={USERS}>
      <FrameLayout
        frameId={frameId}
        frames={FRAMES_WITH_RECORD}
        areas={AREAS}
        cycles={CYCLES}
        shapes={SHAPES_WITH_SQUAD}
      />
    </OrganizationUsersProvider>
  )
}
