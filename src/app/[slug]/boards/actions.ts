'use server'

import { liveblocks } from '@/lib/liveblocks'
import { auth } from '@clerk/nextjs/server'
import { nanoid } from 'nanoid'
import { redirect } from 'next/navigation'

async function roomExists(roomId: string) {
  try {
    await liveblocks.getRoom(roomId)
    return true
  } catch {
    return false
  }
}

export async function createRoom(formData: FormData) {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const roomPrefix = orgId ?? userId

  const slug = String(formData.get('slug') ?? '')
  const title = String(formData.get('title') ?? 'New board')

  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug))
    throw new Error('Invalid slug')

  const roomId = `${roomPrefix}:${slug}`

  if (!(await roomExists(roomId))) {
    await liveblocks.createRoom(`${roomPrefix}:${slug}`, {
      metadata: {
        title,
        createdOn: new Date().toISOString(),
        createdBy: userId,
      },
      defaultAccesses: ['room:write'],
    })

    const pitchId = nanoid()
    const scopeId = nanoid()
    await liveblocks.initializeStorageDocument(roomId, {
      liveblocksType: 'LiveObject',
      data: {
        tasks: { liveblocksType: 'LiveList', data: [] },
        scopes: {
          liveblocksType: 'LiveList',
          data: [
            {
              liveblocksType: 'LiveObject',
              data: {
                id: scopeId,
                pitchId,
                title: 'First scope',
                color: 'color-2',
                core: true,
              },
            },
          ],
        },
        pitches: {
          liveblocksType: 'LiveList',
          data: [
            {
              liveblocksType: 'LiveObject',
              data: { id: pitchId, title: 'First pitch' },
            },
          ],
        },
        info: { liveblocksType: 'LiveObject', data: { name: 'New board' } },
      },
    })
  }

  redirect(`/${orgSlug ?? 'me'}/boards/${slug}`)
}

export async function updateBoard(formData: FormData) {
  const { userId, orgId, orgSlug } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const roomId = formData.get('roomId')
  const title = String(formData.get('title'))
  const slug = formData.get('slug')
  const boardOrgId = formData.get('orgId')

  if (!roomId || !String(roomId).startsWith(`${orgId ?? userId}:`)) {
    throw new Error('Unauthorized')
  }

  const room = await liveblocks.getRoom(String(roomId))

  if (title !== room.metadata.title) {
    await liveblocks.updateRoom(String(roomId), {
      metadata: {
        createdBy: userId,
        createdOn: new Date().toISOString(),
        ...room.metadata,
        title,
      },
    })
  }

  const newRoomId = `${boardOrgId}:${slug}`
  if (newRoomId !== roomId) {
    await liveblocks.updateRoomId({
      currentRoomId: String(roomId),
      newRoomId: `${boardOrgId}:${slug}`,
    })
  }

  redirect(`/${orgSlug ?? 'me'}/boards`)
}
