// Plain URL builders, with no React, so a server layout can import them too.
// links.ts re-exports them next to the client-only navigation hook.

/** Where a request lives. Every way into a request opens its page, which has a URL. */
export function requestHref(slug: string, requestId: string): string {
  return `/${slug}/product/requests/${requestId}`
}

/** Where an area lives. The breadcrumb on a request page links here. */
export function areaHref(slug: string, areaId: string): string {
  return `/${slug}/product/areas/${areaId}`
}

/**
 * A new Claude chat with a prompt already typed (ADR 0029). Ask Paulo on a
 * request page and Capture with Claude both open one.
 */
export function claudeChatHref(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}
