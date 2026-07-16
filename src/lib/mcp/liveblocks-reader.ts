import { liveblocks } from '@/lib/liveblocks'
import { slugify } from '@/lib/slugify'
import type {
  Cycle,
  CyclePitch,
  CycleScope,
  ScopeTask,
  PitchUpdate,
  ParkingItem,
  Squad,
} from '@/cycle-liveblocks.config'

export type CycleSummary = {
  slug: string
  name: string
  type: string
  start_date: string
  end_date: string
  archived: boolean
}

export type StorageJson = {
  cycle: Cycle
  pitches: CyclePitch[]
  scopes: CycleScope[]
  tasks: ScopeTask[]
  updates: PitchUpdate[]
  parkingItems: ParkingItem[]
  // Optional: rooms created before Squads existed have no squads list.
  squads?: Squad[]
}

export async function listCycleRooms(orgId: string): Promise<CycleSummary[]> {
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${orgId}:cycle:"`,
  })

  return rooms.map((room) => ({
    slug: room.id.split(':').slice(2).join(':'),
    name: String(room.metadata.title ?? ''),
    type: String(room.metadata.type ?? ''),
    start_date: String(room.metadata.start_date ?? ''),
    end_date: String(room.metadata.end_date ?? ''),
    archived: room.metadata.archived === 'true',
  }))
}

export async function getCycleStorage(
  orgId: string,
  cycleSlug: string
): Promise<StorageJson> {
  const roomId = `${orgId}:cycle:${cycleSlug}`
  return (await liveblocks.getStorageDocument(roomId, 'json')) as unknown as StorageJson
}

export function resolvePitch(
  storage: StorageJson,
  pitchSlug: string
): CyclePitch | undefined {
  return storage.pitches.find(
    (p) => p.id === pitchSlug || slugify(p.title) === pitchSlug
  )
}
