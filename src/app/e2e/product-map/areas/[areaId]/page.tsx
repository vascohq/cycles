'use client'

import { useParams } from 'next/navigation'

import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { AreaLayout } from '@/app/[slug]/product/areas/[areaId]/area-page'

import { AREAS, CYCLES, FRAMES, SHAPES, USERS } from '../../fixture'

/** The area page against fixture data. No Liveblocks, no Clerk. */
export default function AreaPageE2E() {
  const { areaId } = useParams<{ areaId: string }>()
  return (
    <OrganizationUsersProvider organizationUsers={USERS}>
      <AreaLayout areaId={areaId} frames={FRAMES} areas={AREAS} cycles={CYCLES} shapes={SHAPES} />
    </OrganizationUsersProvider>
  )
}
