import { CreateCycleDialog } from '@/app/[slug]/cycles/create-cycle-dialog'
import { CreateCycleForm } from '@/app/[slug]/cycles/create-cycle-form'
import { liveblocks } from '@/lib/liveblocks'
import { auth, clerkClient } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Cycles | Cycles',
}

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/cycles`)

  const roomPrefix = orgId ?? userId
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${roomPrefix}:cycle:"`,
  })

  const uniqueUserIds = [
    ...new Set(
      rooms
        .map((room) => room.metadata.createdBy)
        .filter((id): id is string => Boolean(id))
        .map(String)
    ),
  ]
  const clerk = await clerkClient()
  const users = await Promise.all(
    uniqueUserIds.map((id) => clerk.users.getUser(id).catch(() => null))
  )
  const usersById = new Map(uniqueUserIds.map((id, i) => [id, users[i]]))

  return (
    <main className="w-full max-w-screen-md mx-auto px-6 py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold tracking-tight">Cycles</h1>
        <CreateCycleDialog>
          <CreateCycleForm />
        </CreateCycleDialog>
      </div>
      {rooms.length === 0 && (
        <div className="flex items-center justify-center border p-2 rounded-lg text-sm text-muted-foreground text-center h-40">
          No cycles yet.
        </div>
      )}
      {rooms.length > 0 && (
        <ul className="border p-2 rounded-lg">
          {rooms.map((room) => {
            const cycleSlug = room.id.split(':').slice(2).join(':')
            const createdOn = room.metadata.createdOn
              ? new Date(String(room.metadata.createdOn))
              : null
            const createdByUser = room.metadata.createdBy
              ? usersById.get(String(room.metadata.createdBy)) ?? null
              : null

            return (
              <li key={room.id}>
                <Link
                  href={`/${urlSlug}/cycles/${cycleSlug}`}
                  className="p-2 hover:bg-muted flex flex-col gap-1"
                >
                  <span className="text-sm font-semibold">
                    {room.metadata.title ?? 'Untitled cycle'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {room.metadata.type === 'cooldown'
                      ? 'Cooldown'
                      : 'Build cycle'}
                    {room.metadata.start_date &&
                      room.metadata.end_date &&
                      ` · ${String(room.metadata.start_date)} → ${String(room.metadata.end_date)}`}
                    {createdOn &&
                      ` · Created ${createdOn.toLocaleString('en-US', { dateStyle: 'long' })}`}
                    {createdByUser && ` by ${createdByUser.fullName}`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
