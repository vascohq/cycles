import { liveblocks } from '@/lib/liveblocks'
import { slugify } from '@/lib/slugify'
import { readStage } from '@/lib/stage-engine'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import type { Area, Frame } from '@/product-map-liveblocks.config'
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
  const pitch = storage.pitches.find(
    (p) => p.id === pitchSlug || slugify(p.title) === pitchSlug
  )
  // Rooms written before ADR 0023 still hold a `framing` stage. Normalize on the
  // way out, so no read surface ever hands a caller a stage that no longer exists.
  return pitch && { ...pitch, stage: readStage(pitch.stage) }
}

export type ProductMapJson = {
  areas: Area[]
  frames: Frame[]
}

/**
 * Read the org's Product Map room (ADR 0021). An organization that has never
 * captured a frame has no room yet, which is not an error — it reads as an
 * empty map, so `map_list_frames` answers before anybody has written anything.
 */
export async function getProductMapStorage(orgId: string): Promise<ProductMapJson> {
  try {
    const json = (await liveblocks.getStorageDocument(
      productMapRoomId(orgId),
      'json'
    )) as unknown as Partial<ProductMapJson>
    return { areas: json.areas ?? [], frames: json.frames ?? [] }
  } catch {
    return { areas: [], frames: [] }
  }
}
