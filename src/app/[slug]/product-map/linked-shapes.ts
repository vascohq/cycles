import { getCycleStorage } from '@/lib/mcp/liveblocks-reader'
import { linkedShapesFrom, type CycleWindow, type LinkedShape } from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'

/**
 * The shapes that point home to a frame. A frame never stores its shape list,
 * so it is read from the cycle rooms every load (ADR 0022).
 *
 * ponytail: one room read per cycle, in parallel, fail-soft per room. A team
 * with dozens of cycles pays for all of them — cache or read only the recent
 * ones if that ever shows up in the page's timing.
 */
export async function linkedShapes(
  orgPrefix: string,
  cycles: CycleWindow[]
): Promise<LinkedShape[]> {
  const rooms = await Promise.all(
    cycles.map(async (cycle) => {
      try {
        const storage = await getCycleStorage(orgPrefix, cycle.slug)
        return { cycle, shapes: storage.pitches ?? [] }
      } catch {
        return { cycle, shapes: [] }
      }
    })
  )
  return linkedShapesFrom(rooms, getTeamToday(new Date()))
}


