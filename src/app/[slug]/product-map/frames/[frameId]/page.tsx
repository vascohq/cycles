import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { getOrganizationUsers } from '@/lib/users'
import { readCycleWindows } from '@/lib/mcp/liveblocks-reader'
import { linkedShapes } from '../../linked-shapes'
import { FramePage } from './frame-page'

export const metadata: Metadata = {
  title: 'Frame | Cycles',
}

// The same rule as every slug in the app: no slashes, dots or encoded
// characters, so the id can never turn the redirect below into somewhere else.
const FRAME_ID = /^[a-zA-Z0-9_-]+$/

export default async function FrameRoute({
  params,
}: {
  params: Promise<{ slug: string; frameId: string }>
}) {
  const { slug, frameId } = await params
  if (!FRAME_ID.test(frameId)) notFound()

  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/product-map/frames/${frameId}`)

  // The same reads as the Product Map: members to name people, cycle
  // boundaries for freshness, and the cycle rooms for the frame's shapes.
  const orgPrefix = orgId ?? userId
  const organizationUsers = await getOrganizationUsers(orgId)
  const cycles = await readCycleWindows(orgPrefix)
  const shapes = await linkedShapes(orgPrefix, cycles)

  return (
    <FramePage
      roomId={productMapRoomId(orgPrefix)}
      frameId={frameId}
      organizationUsers={organizationUsers}
      cycles={cycles}
      shapes={shapes}
    />
  )
}
