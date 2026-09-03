import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { getOrganizationUsers } from '@/lib/users'
import { readCycleWindows } from '@/lib/mcp/liveblocks-reader'
import { ProductMap } from './product-map'
import { linkedShapes } from './linked-shapes'

export const metadata: Metadata = {
  title: 'Product Map | Cycles',
}

export default async function ProductMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/product-map`)

  // Members are read here so the frame detail can name a Frame owner instead of
  // showing a raw Clerk id. A personal workspace has no org and no member list.
  const organizationUsers = await getOrganizationUsers(orgId)

  // The map names no cycle and needs none to open (ADR 0021). It does read the
  // cycle BOUNDARIES, because freshness is counted in cycles: no cycles means
  // nothing ages, which is the right answer for a team that has never run one.
  const orgPrefix = orgId ?? userId
  const cycles = await readCycleWindows(orgPrefix)
  const shapes = await linkedShapes(orgPrefix, cycles)

  return (
    <ProductMap
      roomId={productMapRoomId(orgPrefix)}
      organizationUsers={organizationUsers}
      cycles={cycles}
      shapes={shapes}
    />
  )
}
