// Pure logic for moving a pitch to another cycle (see ADR 0031). No React, no
// storage. Each cycle is its own room (ADR 0002), so a move is a copy of the
// pitch's whole subtree into the target room and a removal from the source.
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  PitchUpdate,
  ParkingItem,
  Squad,
} from '@/cycle-liveblocks.config'
import { slugify } from './slugify'

export type PitchBundle = {
  pitch: CyclePitch
  scopes: CycleScope[]
  tasks: ScopeTask[]
  updates: PitchUpdate[]
  parkingItems: ParkingItem[]
  /** The pitch's squad in the source cycle, or null when unassigned or dangling. */
  squad: Squad | null
}

type CycleContents = {
  pitches: CyclePitch[]
  scopes: CycleScope[]
  tasks: ScopeTask[]
  updates: PitchUpdate[]
  parkingItems: ParkingItem[]
  squads?: Squad[]
}

/**
 * Everything that belongs to one pitch, or null when the pitch is not in this
 * cycle. A card belongs to the pitch through its scope when it has one, and
 * through its own `pitchId` when it is Unscoped (ADR 0018). A card whose scope
 * no longer exists falls back to its `pitchId`, so a move never strands it.
 */
export function extractPitchBundle(storage: CycleContents, pitchId: string): PitchBundle | null {
  const pitch = storage.pitches.find((p) => p.id === pitchId)
  if (!pitch) return null

  const scopeIds = new Set(storage.scopes.filter((s) => s.pitchId === pitchId).map((s) => s.id))
  const allScopeIds = new Set(storage.scopes.map((s) => s.id))
  const ownsTask = (t: ScopeTask) =>
    t.scopeId && allScopeIds.has(t.scopeId) ? scopeIds.has(t.scopeId) : t.pitchId === pitchId

  return {
    pitch,
    scopes: storage.scopes.filter((s) => scopeIds.has(s.id)),
    tasks: storage.tasks.filter(ownsTask),
    updates: storage.updates.filter((u) => u.pitchId === pitchId),
    parkingItems: storage.parkingItems.filter((p) => p.pitchId === pitchId),
    squad: (pitch.squadId && storage.squads?.find((s) => s.id === pitch.squadId)) || null,
  }
}

/**
 * Why the pitch cannot land in the target cycle, or null when it can. Pitches
 * are addressed by the slug of their title (ADR 0003), so a second pitch with
 * the same slug would be unreachable: its URL and its slug path would open the
 * other one.
 */
export function moveConflict(
  targetPitches: Pick<CyclePitch, 'id' | 'title'>[],
  pitch: Pick<CyclePitch, 'id' | 'title'>
): string | null {
  const slug = slugify(pitch.title)
  const clash = targetPitches.find((p) => p.id !== pitch.id && slugify(p.title) === slug)
  return clash
    ? `The target cycle already has a pitch named "${clash.title}". Rename one of them first.`
    : null
}
