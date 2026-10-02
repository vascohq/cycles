import { auth } from '@clerk/nextjs/server'
import { SidebarLayout } from '@/components/sidebar-layout'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { ProductSidebar } from './product-sidebar'

/**
 * The Product Map section: Capture and the land as a tree in the sidebar. The
 * sidebar reads the room live in the browser (see ProductSidebar), so this
 * layout does no storage read of its own.
 */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth()
  if (!userId) return children

  return (
    <SidebarLayout
      title="Product Map"
      sidebar={<ProductSidebar roomId={productMapRoomId(orgId ?? userId)} />}
    >
      {children}
    </SidebarLayout>
  )
}
