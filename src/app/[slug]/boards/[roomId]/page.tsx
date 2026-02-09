import { Room } from '@/app/[slug]/boards/[roomId]/room'
import { liveblocks } from '@/lib/liveblocks'
import { getOrganizationUsers } from '@/lib/users'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; roomId: string }>
}): Promise<Metadata> {
  const { roomId: slug } = await params
  const authResult = await auth()
  const { userId, orgId } = authResult
  if (!userId) return { title: 'Cycles' }

  const roomPrefix = orgId ?? userId
  const roomId = `${roomPrefix}:${decodeURIComponent(slug)}`

  try {
    const room = await liveblocks.getRoom(roomId)
    return { title: `${room.metadata.title} | Cycles` }
  } catch {
    return { title: 'Board not found | Cycles' }
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string; roomId: string }>
}) {
  const { roomId: slug } = await params
  const authResult = await auth()
  const { userId, orgId } = authResult
  if (!userId) authResult.redirectToSignIn()

  const roomPrefix = orgId ?? userId

  const roomId = `${roomPrefix}:${decodeURIComponent(slug)}`

  let boardTitle: string
  try {
    const room = await liveblocks.getRoom(roomId)
    boardTitle = String(room.metadata.title)
  } catch {
    notFound()
  }

  const users = await getOrganizationUsers(orgId)

  return (
    <Room roomId={roomId} boardTitle={boardTitle} organizationUsers={users} />
  )
}
