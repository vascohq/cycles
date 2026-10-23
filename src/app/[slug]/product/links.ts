import { useParams, useRouter } from 'next/navigation'

import { requestHref } from './hrefs'

export { areaHref, claudeChatHref, requestHref } from './hrefs'

// The Area filter and the Unmapped area page share one id for "no area".
export { UNMAPPED_AREA } from '@/lib/request-list'

/**
 * Opens a request's page. Every way into a request goes through here or through
 * `requestHref`, so a request always opens on its own URL.
 */
export function useOpenRequestPage(): (requestId: string) => void {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  return (requestId) => router.push(requestHref(slug, requestId))
}
