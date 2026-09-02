import { createClient } from '@liveblocks/client'

/**
 * The one browser-side Liveblocks client. Every room context shares it, so a
 * session opens one connection manager and one auth flow, whichever room it is
 * in — the per-cycle rooms or the org-scoped Product Map room (ADR 0021).
 */
export const liveblocksClient = createClient({
  authEndpoint: '/api/liveblocks-auth',
})

export type UserMeta = {
  id: string
  info: {
    name: string
    username: string
    imageUrl: string
    hasImage: boolean
    initials: string
  }
}
