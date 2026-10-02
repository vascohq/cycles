import { useParams, useRouter } from 'next/navigation'

import { frameHref } from './hrefs'

export { areaHref, claudeChatHref, frameHref } from './hrefs'

// The Area filter and the Unmapped area page share one id for "no area".
export { UNMAPPED_AREA } from '@/lib/frame-list'

/**
 * Opens a frame's page. Every way into a frame goes through here or through
 * `frameHref`, so a frame always opens on its own URL.
 */
export function useOpenFramePage(): (frameId: string) => void {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  return (frameId) => router.push(frameHref(slug, frameId))
}
