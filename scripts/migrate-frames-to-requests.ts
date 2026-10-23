// One-off runner for the Frame → Request rename (spec #282). Delete it, and
// src/lib/migrations/frames-to-requests.ts, once every room is migrated.
//
//   npx jiti scripts/migrate-frames-to-requests.ts            # dry run
//   npx jiti scripts/migrate-frames-to-requests.ts --apply    # writes
//
// Both modes first export every Product Map room and cycle room to
// migration-backup/<roomId>.json. There is no undo other than that export.
import { mkdirSync, writeFileSync } from 'node:fs'
import { Liveblocks, LiveList, LiveObject } from '@liveblocks/node'
import {
  migrateCycleDocument,
  migratePitch,
  migrateProductMapDocument,
} from '../src/lib/migrations/frames-to-requests'

// A key passed on the command line wins over .env.local, which holds the dev
// project's key. Production needs its own key:
//   LIVEBLOCKS_SECRET_KEY=sk_prod_... npx jiti scripts/migrate-frames-to-requests.ts
if (!process.env.LIVEBLOCKS_SECRET_KEY) process.loadEnvFile?.('.env.local')
const secret = process.env.LIVEBLOCKS_SECRET_KEY
if (!secret) throw new Error('LIVEBLOCKS_SECRET_KEY is not set')
console.log(secret.startsWith('sk_prod') ? 'Liveblocks project: production' : 'Liveblocks project: NOT production')

const apply = process.argv.includes('--apply')
const liveblocks = new Liveblocks({ secret })

async function allRoomIds(): Promise<string[]> {
  const ids: string[] = []
  let startingAfter: string | undefined
  do {
    const page = await liveblocks.getRooms({ startingAfter })
    ids.push(...page.data.map((room) => room.id))
    startingAfter = page.nextCursor ?? undefined
  } while (startingAfter)
  return ids.filter((id) => id.endsWith(':product-map') || id.includes(':cycle:'))
}

async function main() {
  mkdirSync('migration-backup', { recursive: true })
  for (const roomId of await allRoomIds()) {
    const doc = (await liveblocks.getStorageDocument(roomId, 'json')) as Record<string, unknown>
    writeFileSync(`migration-backup/${roomId.replaceAll(':', '_')}.json`, JSON.stringify(doc, null, 2))

    const isMap = roomId.endsWith(':product-map')
    const next = isMap ? migrateProductMapDocument(doc) : migrateCycleDocument(doc)
    if (JSON.stringify(next) === JSON.stringify(doc)) {
      console.log(`${roomId}: already migrated`)
      continue
    }
    console.log(`${roomId}: ${apply ? 'migrating' : 'would migrate'}`)
    if (!apply) continue

    await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
      if (isMap) {
        const requests = (next.requests as any[]).map((r) => new LiveObject(r))
        root.set('requests', new LiveList(requests))
        root.delete('frames')
        return
      }
      // @liveblocks/node's LiveList has no toArray(); map() is the way to read it.
      // A pitch is a LiveObject in some rooms and a plain object in others (the
      // writer reads both through getField), so handle both shapes.
      const list = root.get('pitches')
      const pitches: any[] = list?.map((pitch: any) => pitch) ?? []
      pitches.forEach((pitch, index) => {
        const live = typeof pitch?.set === 'function'
        const before = (live ? pitch.toJSON() : pitch) as Record<string, unknown>
        const after = migratePitch(before)
        if (JSON.stringify(before) === JSON.stringify(after)) return
        if (!live) {
          list.set(index, after)
          return
        }
        for (const key of Object.keys(before)) if (!(key in after)) pitch.delete(key)
        for (const [key, value] of Object.entries(after)) {
          if (JSON.stringify(before[key]) !== JSON.stringify(value)) pitch.set(key, value)
        }
      })
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
