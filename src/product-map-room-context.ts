import { LiveList } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import type { ProductMapStorage } from './product-map-liveblocks.config'
import { liveblocksClient, type UserMeta } from './liveblocks-browser-client'

// The Product Map has no per-user cursor or selection yet, so presence is empty.
type Presence = Record<string, never>

export const {
  suspense: { RoomProvider: ProductMapRoomProvider, useStorage: useProductMapStorage },
} = createRoomContext<Presence, ProductMapStorage, UserMeta>(liveblocksClient)

export function productMapInitialStorage(): ProductMapStorage {
  return {
    areas: new LiveList([]),
    frames: new LiveList([]),
  }
}
