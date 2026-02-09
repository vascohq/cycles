import { updateBoard } from '@/app/[slug]/boards/actions'
import { ArchiveCollapsible } from '@/app/[slug]/boards/[roomId]/archive-collapsible'
import { BoardContextMenu } from '@/app/[slug]/boards/board-context-menu'
import { CreateBoardDialog } from '@/app/[slug]/boards/create-board-dialog'
import { CreateBoardForm } from '@/app/[slug]/boards/create-board-form'
import { OrganizationSelector } from '@/app/[slug]/boards/organization-selector'
import { Button } from '@/components/ui/button'
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { liveblocks } from '@/lib/liveblocks'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { RoomInfo } from '@liveblocks/node'
import { groupBy } from 'lodash'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Boards | Cycles',
}

export default async function OrganizationsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await auth()
  const { userId, orgId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/boards`)

  const roomPrefix = orgId ?? userId
  const { data: rooms } = await liveblocks.getRooms({
    query: `roomId^"${roomPrefix}:"`,
  })

  const { active: activeRooms, archived: archivedRooms } = groupBy(
    rooms,
    (room) => (room.metadata.archived ? 'archived' : 'active')
  )

  // Batch-fetch all unique creator users to avoid N+1 queries
  const allRooms = [...(activeRooms ?? []), ...(archivedRooms ?? [])]
  const uniqueUserIds = [
    ...new Set(
      allRooms
        .map((room) => room.metadata.createdBy)
        .filter((id): id is string => Boolean(id))
        .map(String)
    ),
  ]
  const clerk = await clerkClient()
  const users = await Promise.all(
    uniqueUserIds.map((id) => clerk.users.getUser(id).catch(() => null))
  )
  const usersById = new Map(
    uniqueUserIds.map((id, i) => [id, users[i]])
  )

  return (
    <main className="mt-16 w-full max-w-screen-md mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="font-bold">Boards</h1>
        <CreateBoardButton roomPrefix={roomPrefix} />
      </div>
      {!activeRooms && (
        <div className="flex items-center justify-center border p-2 rounded-lg text-sm text-muted-foreground text-center h-40">
          There is not board yet.
        </div>
      )}
      {activeRooms && (
        <ul className="border p-2 rounded-lg">
          {activeRooms.map((room) => (
            <BoardListItem key={room.id} room={room} orgSlug={slug} usersById={usersById} />
          ))}
        </ul>
      )}
      {archivedRooms && (
        <div className="mt-8">
          <ArchiveCollapsible
            label={<>Archived boards ({archivedRooms.length})</>}
          >
            <ul className="border p-2 rounded-lg">
              {archivedRooms.map((room) => (
                <BoardListItem key={room.id} room={room} orgSlug={slug} usersById={usersById} />
              ))}
            </ul>
          </ArchiveCollapsible>
        </div>
      )}
    </main>
  )
}

function CreateBoardButton({ roomPrefix }: { roomPrefix: string }) {
  return (
    <CreateBoardDialog roomPrefix={roomPrefix}>
      <CreateBoardForm />
    </CreateBoardDialog>
  )
}

function BoardListItem({
  room,
  orgSlug,
  usersById,
}: {
  room: RoomInfo
  orgSlug: string
  usersById: Map<string, Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>['users']['getUser']>> | null>
}) {
  const slug = room.id.split(':')[1]
  const createdOn = room.metadata.createdOn
    ? new Date(String(room.metadata.createdOn))
    : null
  const createdByUser = room.metadata.createdBy
    ? usersById.get(String(room.metadata.createdBy)) ?? null
    : null

  return (
    <div className="p-2 hover:bg-muted flex gap-1">
      <div className="flex flex-col gap-1 flex-1">
        <Link href={`/${orgSlug}/boards/${slug}`} className="text-sm font-semibold">
          {room.metadata.title ?? 'No title'}
        </Link>
        <div className="text-muted-foreground text-xs">
          Created on{' '}
          {createdOn?.toLocaleString('en-US', { dateStyle: 'long' }) ??
            'unknown'}{' '}
          by {createdByUser?.fullName ?? 'unknown'}
        </div>
      </div>
      <BoardContextMenu
        roomId={room.id}
        archived={Boolean(room.metadata.archived)}
        boardSettingsForm={
          <form className="flex flex-col gap-4" action={updateBoard}>
            <input type="hidden" name="roomId" value={room.id} />
            <DialogHeader>
              <DialogTitle>Board settings</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2">
                <Label htmlFor="title">Board title</Label>
                <Input
                  name="title"
                  id="title"
                  defaultValue={room.metadata.title}
                  required
                />
              </section>
              <section className="flex flex-col gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  name="slug"
                  id="slug"
                  defaultValue={slug}
                  required
                  minLength={5}
                  pattern="[a-z0-9\-]*"
                />
                <p className="text-muted-foreground text-xs">
                  Must contain only lowercase letters, digits, and dashes.
                  <br />
                  Warning: changing the board slug will change its URL.
                </p>
              </section>
              <div className="hidden">
                <section className="hidden flex-col">
                  <Label htmlFor="orgId" className="mb-2">
                    Organization
                  </Label>
                  <OrganizationSelector />
                </section>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        }
      />
    </div>
  )
}


