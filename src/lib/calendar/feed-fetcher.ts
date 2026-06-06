import { normalizeIcsFeed, type DateRange, type OverlayBand } from './ics-normalizer'
import type { IntegrationConfig } from './integration-config'

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

const ONE_HOUR_SECONDS = 3600

/**
 * Fetch every configured calendar feed server-side and normalize it into
 * overlay bands. Each feed is fetched independently and fails soft: a feed that
 * 404s, rejects, or can't be parsed contributes no bands rather than breaking
 * the others (a broken Humi token must never take down Mission Control).
 *
 * `webcal://` URLs are fetched over `https://`. Feeds are cached with hourly
 * revalidation; holidays barely change and vacations only a couple times a day.
 */
export async function fetchOverlayBands(
  config: IntegrationConfig,
  range: DateRange,
  fetchImpl: FetchImpl = fetch
): Promise<OverlayBand[]> {
  const perFeed = await Promise.all(
    config.feeds.map(async (feed) => {
      try {
        const url = feed.url.replace(/^webcal:\/\//i, 'https://')
        const res = await fetchImpl(url, {
          // Next.js fetch caching; ignored by non-Next fetch implementations.
          next: { revalidate: ONE_HOUR_SECONDS },
        } as RequestInit)
        if (!res.ok) {
          console.warn(`[calendar] feed "${feed.label}" returned ${res.status}; skipping`)
          return []
        }
        const text = await res.text()
        return normalizeIcsFeed(text, { kind: feed.kind, label: feed.label }, range)
      } catch (err) {
        console.warn(`[calendar] feed "${feed.label}" failed to load; skipping`, err)
        return []
      }
    })
  )

  return perFeed.flat()
}
