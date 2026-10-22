'use client'

import { useState } from 'react'

import { MapWorkspace } from '@/app/[slug]/product/map-workspace'
import { OrganizationUsersProvider } from '@/components/organization-users-context'
import { DEFAULT_LENS, renderProductMap } from '@/lib/product-map-engine'

import { AREAS, CYCLES, REQUESTS, SHAPES, TODAY, USERS } from '../fixture'

/** The Product Map's workspace against fixture data: map, filters and list. */
export default function WorkspaceE2EPage() {
  const [opened, setOpened] = useState<string | null>(null)
  const model = renderProductMap({
    areas: AREAS,
    requests: REQUESTS,
    cycles: CYCLES,
    shapes: SHAPES,
    lens: DEFAULT_LENS,
    today: TODAY,
  })
  return (
    <OrganizationUsersProvider organizationUsers={USERS}>
      <MapWorkspace
        title={
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-xl">Product Map</h1>
            <span data-testid="opened-request" className="text-xs text-muted-foreground">
              {opened ? `Opened: ${opened}` : 'No request open'}
            </span>
          </div>
        }
        areas={model.areas}
        pins={[...model.pins, ...model.resolved]}
        onOpenRequest={setOpened}
        withUnmapped
      />
    </OrganizationUsersProvider>
  )
}
