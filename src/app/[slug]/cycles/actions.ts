'use server'

import { liveblocks } from '@/lib/liveblocks'
import type { PaletteCycleItem } from '@/components/command-palette/types'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/**
 * List the current org's cycles for the command palette. Mirrors the listing in
 * cycles/page.tsx (room metadata, no need to open each room) and is fetched
 * lazily on the palette's first open — no per-page cost when the palette is
 * never used.
 */
export async function listCycles(): Promise<PaletteCycleItem[]> {
  const { userId, orgId } = await auth()
  if (!userId) return []

  const roomPrefix = orgId ?? userId
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${roomPrefix}:cycle:"`,
  })

  return rooms
    .map((room) => ({
      slug: room.id.split(':').slice(2).join(':'),
      title: String(room.metadata.title ?? 'Untitled cycle'),
      type:
        room.metadata.type === 'cooldown'
          ? ('cooldown' as const)
          : ('build' as const),
      start_date: room.metadata.start_date
        ? String(room.metadata.start_date)
        : '',
      end_date: room.metadata.end_date ? String(room.metadata.end_date) : '',
      createdOn: room.metadata.createdOn ? String(room.metadata.createdOn) : '',
    }))
    .sort((a, b) => (a.createdOn > b.createdOn ? -1 : 1))
    .map(({ createdOn: _createdOn, ...cycle }) => cycle)
}

async function roomExists(roomId: string) {
  try {
    await liveblocks.getRoom(roomId)
    return true
  } catch {
    return false
  }
}

export async function createCycleRoom(formData: FormData) {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const slug = String(formData.get('slug') ?? '')
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug))
    throw new Error('Invalid slug')

  const name = String(formData.get('name') ?? 'New cycle')
  const type = String(formData.get('type') ?? 'build')
  const startDate = String(formData.get('start_date') ?? '')
  const endDate = String(formData.get('end_date') ?? '')
  const slackChannel = String(
    formData.get('slack_channel') ?? '#product-general'
  )

  const roomPrefix = orgId ?? userId
  const roomId = `${roomPrefix}:cycle:${slug}`

  if (!(await roomExists(roomId))) {
    await liveblocks.createRoom(roomId, {
      metadata: {
        title: name,
        createdOn: new Date().toISOString(),
        createdBy: userId,
        type,
        start_date: startDate,
        end_date: endDate,
        slack_channel: slackChannel,
      },
      defaultAccesses: ['room:write'],
    })

    await liveblocks.initializeStorageDocument(roomId, {
      liveblocksType: 'LiveObject',
      data: {
        cycle: {
          liveblocksType: 'LiveObject',
          data: {
            name,
            type,
            start_date: startDate,
            end_date: endDate,
            slack_channel: slackChannel,
          },
        },
        pitches: { liveblocksType: 'LiveList', data: [] },
        scopes: { liveblocksType: 'LiveList', data: [] },
        tasks: { liveblocksType: 'LiveList', data: [] },
        updates: { liveblocksType: 'LiveList', data: [] },
        parkingItems: { liveblocksType: 'LiveList', data: [] },
      },
    })
  }

  redirect(`/${orgSlug ?? 'me'}/cycles/${slug}`)
}
