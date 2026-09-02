'use client'

import { ClientSideSuspense } from '@liveblocks/react'
import {
  ProductMapRoomProvider,
  useProductMapStorage,
  productMapInitialStorage,
} from '@/product-map-room-context'

export function ProductMap({ roomId }: { roomId: string }) {
  return (
    <ProductMapRoomProvider
      id={roomId}
      initialPresence={{}}
      initialStorage={productMapInitialStorage()}
    >
      <ClientSideSuspense fallback={<ProductMapSkeleton />}>
        {() => <ProductMapView />}
      </ClientSideSuspense>
    </ProductMapRoomProvider>
  )
}

function ProductMapView() {
  // Guarded reads: `initialStorage` only seeds a brand-new room, so a room
  // whose root predates one of these keys must still render, not throw.
  const areaCount = useProductMapStorage((root) => root.areas?.length ?? 0)
  const frameCount = useProductMapStorage((root) => root.frames?.length ?? 0)
  const isEmpty = areaCount === 0 && frameCount === 0

  return (
    <Shell>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <p className="font-display text-lg">Nothing on the Product Map yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A frame records one problem in your product. The first frame you
            capture appears here as a pin.
          </p>
        </div>
      ) : (
        // Areas and pins arrive with #220 and #219. Until then a non-empty
        // Product Map is only reachable through MCP, so show counts, not a lie.
        <p className="text-sm text-muted-foreground">
          {areaCount} {areaCount === 1 ? 'area' : 'areas'} · {frameCount}{' '}
          {frameCount === 1 ? 'frame' : 'frames'}
        </p>
      )}
    </Shell>
  )
}

function ProductMapSkeleton() {
  return (
    <Shell>
      <div className="h-48 animate-pulse rounded-xl border border-dashed bg-muted/40" />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Product Map</h1>
      {children}
    </main>
  )
}
