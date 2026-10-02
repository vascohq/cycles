import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { getOrganizationUsers } from '@/lib/users'
import { readCycleWindows } from '@/lib/mcp/liveblocks-reader'
import { linkedShapes } from '../../linked-shapes'
import { AreaPage } from './area-page'

export const metadata: Metadata = {
  title: 'Area | Cycles',
}

// The same rule as every slug in the app: no slashes, dots or encoded
// characters, so the id can never turn the redirect below into somewhere else.
const AREA_ID = /^[a-zA-Z0-9_-]+$/

export default async function AreaRoute({
  params,
}: {
  params: Promise<{ slug: string; areaId: string }>
}) {
  const { slug, areaId } = await params
  if (!AREA_ID.test(areaId)) notFound()

  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/product/areas/${areaId}`)

  // The same reads as the Product Map: members to name people, cycle
  // boundaries for freshness, and the cycle rooms for the frames' shapes.
  const orgPrefix = orgId ?? userId
  const organizationUsers = await getOrganizationUsers(orgId)
  const cycles = await readCycleWindows(orgPrefix)
  const shapes = await linkedShapes(orgPrefix, cycles)

  return (
    <AreaPage
      roomId={productMapRoomId(orgPrefix)}
      areaId={areaId}
      organizationUsers={organizationUsers}
      cycles={cycles}
      shapes={shapes}
    />
  )
}
