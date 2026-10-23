'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getProductMapStorage, listCycleRooms } from '@/lib/mcp/liveblocks-reader'
import { upsertPitch } from '@/lib/mcp/liveblocks-writer'
import { isSharp, isUpcomingCycle, seedPitchFrame } from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'

/**
 * Pitch a request: create a **Pitch** at `framing` in an upcoming cycle that
 * carries it (ADR 0032). The betting table later keeps the pitch or deletes it.
 *
 * The request is re-read here rather than trusted from the client, because this
 * is the rule that has to hold: only a SHARP request can be pitched.
 *
 * The pitch copies its frame from the request now. After that the pitch owns
 * it, so a past cycle always shows what the team committed to. Nothing here
 * writes back to the Product Map.
 */
export async function pitchRequest(input: {
  requestId: string
  cycleSlug: string
  title: string
}): Promise<{ pitchId: string }> {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')
  if (!/^[a-zA-Z0-9_-]+$/.test(input.cycleSlug)) throw new Error('Invalid cycle')

  const orgPrefix = orgId ?? userId
  const { requests } = await getProductMapStorage(orgPrefix)
  const request = requests.find((f) => f.id === input.requestId)
  if (!request) throw new Error(`Request not found: "${input.requestId}"`)
  if (!isSharp(request)) {
    throw new Error(
      'A rough request cannot be pitched. Give it a problem, an appetite and an outcome first.'
    )
  }

  // listCycleRooms, not readCycleWindows: a Liveblocks failure must surface as
  // itself, not as "there is no upcoming cycle".
  const cycle = (await listCycleRooms(orgPrefix)).find((c) => c.slug === input.cycleSlug)
  if (!cycle || !isUpcomingCycle(cycle, getTeamToday(new Date()))) {
    throw new Error('Pitch into an upcoming cycle. Create the next cycle first if there is none.')
  }

  const result = await upsertPitch(`${orgPrefix}:cycle:${input.cycleSlug}`, {
    title: input.title.trim() || request.problem,
    stage: 'framing',
    ...seedPitchFrame([request]),
    request_ids: [request.id],
  })

  revalidatePath(`/${orgSlug ?? 'me'}/product`)
  return { pitchId: result.id }
}
