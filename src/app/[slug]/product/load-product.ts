import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { getOrganizationUsers } from '@/lib/users'
import { readCycleWindows } from '@/lib/mcp/liveblocks-reader'
import { linkedShapes } from './linked-shapes'

/**
 * What every Product Map page reads on the server: the room, the members, the
 * cycle boundaries and the shapes. `path` is the part of the URL after
 * `/product`, so a stale workspace slug redirects to the same page in the
 * workspace that is active.
 */
export async function loadProduct(slug: string, path: string) {
  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/product${path}`)

  // Members are read here so a page can name a Frame owner instead of showing a
  // raw Clerk id. A personal workspace has no org and no member list.
  const organizationUsers = await getOrganizationUsers(orgId)

  // The map names no cycle and needs none to open (ADR 0021). It does read the
  // cycle BOUNDARIES, because freshness is counted in cycles: no cycles means
  // nothing ages, which is the right answer for a team that has never run one.
  // The cycle rooms are read too, because a frame never stores its shapes.
  const orgPrefix = orgId ?? userId
  const cycles = await readCycleWindows(orgPrefix)
  const shapes = await linkedShapes(orgPrefix, cycles)

  return { roomId: productMapRoomId(orgPrefix), organizationUsers, cycles, shapes }
}
