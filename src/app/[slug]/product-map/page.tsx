import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { getOrganizationUsers } from '@/lib/users'
import { ProductMap } from './product-map'

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

  // No cycle lookup on purpose: the Product Map is org-scoped and opens for an
  // organization that has never created a cycle (ADR 0021).
  return (
    <ProductMap
      roomId={productMapRoomId(orgId ?? userId)}
      organizationUsers={organizationUsers}
    />
  )
}
