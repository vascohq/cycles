// Plain URL builders, with no React, so a server layout can import them too.
// links.ts re-exports them next to the client-only navigation hook.

/** Where a frame lives. Every way into a frame opens its page, which has a URL. */
export function frameHref(slug: string, frameId: string): string {
  return `/${slug}/product/frames/${frameId}`
}

/** Where an area lives. The breadcrumb on a frame page links here. */
export function areaHref(slug: string, areaId: string): string {
  return `/${slug}/product/areas/${areaId}`
}

/**
 * A new Claude chat with a prompt already typed (ADR 0029). Ask Paulo on a
 * frame page and Capture with Claude both open one.
 */
export function claudeChatHref(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}
