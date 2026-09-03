'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getProductMapStorage } from '@/lib/mcp/liveblocks-reader'
import { upsertPitch } from '@/lib/mcp/liveblocks-writer'
import { isSharp } from '@/lib/product-map-engine'

/**
 * Bet on a frame: create a **Shape** in a cycle that points home to it.
 *
 * The frame is re-read here rather than trusted from the client, because this is
 * the one rule that has to hold — only a SHARP frame can be bet on, and nobody
 * bets on half a frame.
 *
 * The shape's problem is a COPY taken now: the **Frame as bet**. The frame on
 * the Product Map keeps changing and this copy never does, so a past cycle always shows
 * what the team committed to (ADR 0022). Nothing here writes back to the Product Map.
 */
export async function betOnFrame(input: {
  frameId: string
  cycleSlug: string
  title: string
}): Promise<{ shapeId: string }> {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')
  if (!/^[a-zA-Z0-9_-]+$/.test(input.cycleSlug)) throw new Error('Invalid cycle')

  const orgPrefix = orgId ?? userId
  const { frames } = await getProductMapStorage(orgPrefix)
  const frame = frames.find((f) => f.id === input.frameId)
  if (!frame) throw new Error(`Frame not found: "${input.frameId}"`)
  if (!isSharp(frame)) {
    throw new Error(
      'A rough frame cannot become a shape. Give it a problem and an appetite first.'
    )
  }

  // A new shape starts at `shaping`: framing already happened, on the Product Map
  // (ADR 0023).
  const result = await upsertPitch(`${orgPrefix}:cycle:${input.cycleSlug}`, {
    title: input.title.trim() || frame.problem,
    stage: 'shaping',
    frame_problem: frame.problem,
    frame_id: frame.id,
  })

  revalidatePath(`/${orgSlug ?? 'me'}/product-map`)
  return { shapeId: result.id }
}
