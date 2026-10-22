'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getProductMapStorage } from '@/lib/mcp/liveblocks-reader'
import { upsertPitch } from '@/lib/mcp/liveblocks-writer'
import { isSharp } from '@/lib/product-map-engine'

/**
 * Bet on a request: create a **Shape** in a cycle that points home to it.
 *
 * The request is re-read here rather than trusted from the client, because this is
 * the one rule that has to hold — only a SHARP request can be bet on, and nobody
 * bets on half a request.
 *
 * The shape's problem is a COPY taken now: the **Frame as bet**. The request on
 * the Product Map keeps changing and this copy never does, so a past cycle always shows
 * what the team committed to (ADR 0022). Nothing here writes back to the Product Map.
 */
export async function betOnRequest(input: {
  requestId: string
  cycleSlug: string
  title: string
}): Promise<{ shapeId: string }> {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')
  if (!/^[a-zA-Z0-9_-]+$/.test(input.cycleSlug)) throw new Error('Invalid cycle')

  const orgPrefix = orgId ?? userId
  const { requests } = await getProductMapStorage(orgPrefix)
  const request = requests.find((f) => f.id === input.requestId)
  if (!request) throw new Error(`Request not found: "${input.requestId}"`)
  if (!isSharp(request)) {
    throw new Error(
      'A rough request cannot become a shape. Give it a problem and an appetite first.'
    )
  }

  // A new shape starts at `shaping`: framing already happened, on the Product Map
  // (ADR 0023).
  const result = await upsertPitch(`${orgPrefix}:cycle:${input.cycleSlug}`, {
    title: input.title.trim() || request.problem,
    stage: 'shaping',
    frame_problem: request.problem,
    request_id: request.id,
  })

  revalidatePath(`/${orgSlug ?? 'me'}/product`)
  return { shapeId: result.id }
}
