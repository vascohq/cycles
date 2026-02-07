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
  const { userId, orgId } = auth()
  if (!userId) throw new Error('Not authenticated')

  const roomPrefix = orgId ?? userId

  const slug = formData.get('slug')
  const title = String(formData.get('title') ?? 'New board')

  if (!slug) throw new Error('No slug')

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

  redirect(`/boards/${slug}`)
}
