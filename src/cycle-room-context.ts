import { createRoomContext } from '@liveblocks/react'
import type { CycleStorage } from './cycle-liveblocks.config'
import { LiveList, LiveObject } from '@liveblocks/client'
import { liveblocksClient, type UserMeta } from './liveblocks-browser-client'

type Presence = {
  activePitchId?: string | null
}

export const {
  suspense: {
    RoomProvider: CycleRoomProvider,
    useStorage: useCycleStorage,
    useMutation: useCycleMutation,
    useOthers: useCycleOthers,
    useSelf: useCycleSelf,
  },
} = createRoomContext<Presence, CycleStorage, UserMeta>(liveblocksClient)

export function cycleInitialStorage(): CycleStorage {
  return {
    cycle: new LiveObject({
      name: '',
      type: 'build',
      start_date: '',
      end_date: '',
    }),
    pitches: new LiveList([]),
    scopes: new LiveList([]),
    tasks: new LiveList([]),
    updates: new LiveList([]),
    parkingItems: new LiveList([]),
    squads: new LiveList([]),
  }
}
