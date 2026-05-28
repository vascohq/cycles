import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import type { CycleStorage } from './cycle-liveblocks.config'
import { LiveList, LiveObject } from '@liveblocks/client'

const client = createClient({
  authEndpoint: '/api/liveblocks-auth',
})

type Presence = {
  activePitchId?: string | null
}

type UserMeta = {
  id: string
  info: {
    name: string
    username: string
    imageUrl: string
    hasImage: boolean
    initials: string
  }
}

export const {
  suspense: {
    RoomProvider: CycleRoomProvider,
    useStorage: useCycleStorage,
    useMutation: useCycleMutation,
    useOthers: useCycleOthers,
    useSelf: useCycleSelf,
  },
} = createRoomContext<Presence, CycleStorage, UserMeta>(client)

export function cycleInitialStorage(): CycleStorage {
  return {
    cycle: new LiveObject({
      name: '',
      type: 'build',
      start_date: '',
      end_date: '',
      slack_channel: '',
    }),
    pitches: new LiveList([]),
    scopes: new LiveList([]),
    tasks: new LiveList([]),
    updates: new LiveList([]),
    parkingItems: new LiveList([]),
  }
}
