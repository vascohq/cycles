import { useParams, useRouter } from 'next/navigation'

/** Where a frame lives. Every way into a frame opens its page, which has a URL. */
export function frameHref(slug: string, frameId: string): string {
  return `/${slug}/product/frames/${frameId}`
}

// The Area filter and the Unmapped area page share one id for "no area".
export { UNMAPPED_AREA } from '@/lib/frame-list'

/** Where an area lives. The breadcrumb on a frame page links here. */
export function areaHref(slug: string, areaId: string): string {
  return `/${slug}/product/areas/${areaId}`
}

/**
 * Opens a frame's page. Every way into a frame goes through here or through
 * `frameHref`, so a frame always opens on its own URL.
 */
export function useOpenFramePage(): (frameId: string) => void {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  return (frameId) => router.push(frameHref(slug, frameId))
}
