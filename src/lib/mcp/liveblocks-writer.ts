import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/node'
import { liveblocks } from '@/lib/liveblocks'
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  ParkingItem,
  PitchUpdate,
  Squad,
} from '@/cycle-liveblocks.config'
import { needleAfterDeletingLatest } from '@/lib/needle-engine'
import {
  assignSquadColor,
  resolveSquadByName,
  squadKey,
  isSquadNameTaken,
} from '@/lib/squad-engine'

type UpsertResult = { created: boolean; id: string }

async function roomExists(roomId: string): Promise<boolean> {
  try {
    await liveblocks.getRoom(roomId)
    return true
  } catch {
    return false
  }
}

// ── Cycle ──

// Mirrors the createCycleRoom server action: creates the Liveblocks room and
// initializes its empty storage document. Idempotent — returns created:false if
// a room with this id already exists rather than clobbering it.
export async function createCycle(
  roomId: string,
  userId: string,
  params: {
    name: string
    type: string
    start_date: string
    end_date: string
  }
): Promise<{ created: boolean }> {
  if (await roomExists(roomId)) return { created: false }

  await liveblocks.createRoom(roomId, {
    metadata: {
      title: params.name,
      createdOn: new Date().toISOString(),
      createdBy: userId,
      type: params.type,
      start_date: params.start_date,
      end_date: params.end_date,
    },
    defaultAccesses: ['room:write'],
  })

  await liveblocks.initializeStorageDocument(roomId, {
    liveblocksType: 'LiveObject',
    data: {
      cycle: {
        liveblocksType: 'LiveObject',
        data: {
          name: params.name,
          type: params.type,
          start_date: params.start_date,
          end_date: params.end_date,
        },
      },
      pitches: { liveblocksType: 'LiveList', data: [] },
      scopes: { liveblocksType: 'LiveList', data: [] },
      tasks: { liveblocksType: 'LiveList', data: [] },
      updates: { liveblocksType: 'LiveList', data: [] },
      parkingItems: { liveblocksType: 'LiveList', data: [] },
      squads: { liveblocksType: 'LiveList', data: [] },
    },
  })

  return { created: true }
}

type CycleFields = {
  name: string
  type: string
  start_date: string
  end_date: string
}

// Partial-update the cycle's top-level fields. Any field left undefined is
// unchanged; an empty string clears it (per ADR 0011). Cycle fields live in two
// places — the storage `cycle` LiveObject (read by get_cycle) and the room
// metadata (read by list_cycles) — so we write both to keep them in sync.
export async function updateCycle(
  roomId: string,
  params: Partial<CycleFields>
): Promise<{ updated: boolean; cycle: CycleFields }> {
  if (!(await roomExists(roomId))) {
    throw new Error(`Cycle not found: "${roomId}"`)
  }

  let cycle: CycleFields | undefined

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const c = root.get('cycle')
    // undefined = omitted = leave unchanged. '' = clear. Guard explicitly so an
    // omitted field is never coerced away (the timebox-nullification incident).
    if (params.name !== undefined) c.set('name', params.name)
    if (params.type !== undefined) c.set('type', params.type)
    if (params.start_date !== undefined) c.set('start_date', params.start_date)
    if (params.end_date !== undefined) c.set('end_date', params.end_date)
    cycle = {
      name: c.get('name'),
      type: c.get('type'),
      start_date: c.get('start_date'),
      end_date: c.get('end_date'),
    }
  })

  // Mirror the same changed subset into room metadata. `name` is stored as
  // `title` in metadata (list_cycles reads it from there).
  const metadata: Record<string, string> = {}
  if (params.name !== undefined) metadata.title = params.name
  if (params.type !== undefined) metadata.type = params.type
  if (params.start_date !== undefined) metadata.start_date = params.start_date
  if (params.end_date !== undefined) metadata.end_date = params.end_date
  if (Object.keys(metadata).length > 0) {
    await liveblocks.updateRoom(roomId, { metadata })
  }

  return { updated: true, cycle: cycle! }
}

// Items pushed correctly are LiveObjects (use .get/.set).
// If a list also contains plain objects pushed by buggy older code, treat them
// as read-only and access fields directly so iteration doesn't crash.
function getField(item: any, key: string): any {
  return typeof item?.get === 'function' ? item.get(key) : item?.[key]
}


// Resolve a squad name to an id within the cycle's squad list, creating the
// squad (with an auto-assigned color) when no case-insensitive match exists.
function resolveOrCreateSquadId(squads: any, name: string): string {
  const arr = squads.toArray().map((s: any) => ({
    id: getField(s, 'id'),
    name: getField(s, 'name'),
    color: getField(s, 'color'),
  }))
  const existing = resolveSquadByName(arr, name)
  if (existing) return existing.id
  const usedColors = arr.map((s: any) => s.color).filter(Boolean)
  const id = nanoid()
  squads.push(new LiveObject({ id, name, color: assignSquadColor(usedColors) }))
  return id
}

// ── Pitch ──

export async function upsertPitch(
  roomId: string,
  params: {
    id?: string
    title: string
    stage: string
    // Partial-update fields: undefined = leave unchanged (on update) / fall back
    // to '' (on create). NEVER coerce an omitted field to '' before this point —
    // doing so silently wipes it on update (the timebox-nullification incident).
    frame_problem?: string
    frame_outcome?: string
    timebox_start?: string
    timebox_end?: string
    emoji?: string
    notion_url?: string
    // Squad NAME (not id). Resolved case-insensitively, auto-created on miss.
    // Empty/whitespace clears the assignment; undefined leaves it unchanged.
    squad?: string
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')
    const squads = root.get('squads')

    // null = clear, string = assign, undefined = leave unchanged.
    let squadId: string | undefined | null
    if (params.squad !== undefined) {
      squadId =
        squadKey(params.squad) === ''
          ? null
          : resolveOrCreateSquadId(squads, params.squad)
    }

    if (created) {
      const pitch: CyclePitch = {
        id,
        title: params.title,
        stage: params.stage as CyclePitch['stage'],
        needle: null,
        frame_problem: params.frame_problem ?? '',
        frame_outcome: params.frame_outcome ?? '',
        timebox_start: params.timebox_start ?? '',
        timebox_end: params.timebox_end ?? '',
        emoji: params.emoji ?? '',
        notion_url: params.notion_url ?? '',
        ...(squadId ? { squadId } : {}),
      }
      pitches.push(new LiveObject(pitch))
    } else {
      const existing = pitches.find((p: any) => getField(p, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('title', params.title)
      existing.set('stage', params.stage)
      // undefined = omitted = leave unchanged. Guarding here (not relying on
      // Liveblocks treating set(undefined) as a no-op) makes the contract explicit
      // and matches the squad handling below.
      if (params.frame_problem !== undefined) existing.set('frame_problem', params.frame_problem)
      if (params.frame_outcome !== undefined) existing.set('frame_outcome', params.frame_outcome)
      if (params.timebox_start !== undefined) existing.set('timebox_start', params.timebox_start)
      if (params.timebox_end !== undefined) existing.set('timebox_end', params.timebox_end)
      if (params.emoji !== undefined) existing.set('emoji', params.emoji)
      if (params.notion_url !== undefined) existing.set('notion_url', params.notion_url)
      // squadId: null = clear (remove key), string = assign, undefined = leave.
      if (squadId === null) existing.delete('squadId')
      else if (squadId !== undefined) existing.set('squadId', squadId)
    }
  })

  if (notFound) throw new Error(`Pitch not found: "${id}"`)
  return { created, id }
}

// ── Squad ──

export async function upsertSquad(
  roomId: string,
  params: {
    id?: string
    name: string
    color?: string
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let nameTaken = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const squads = root.get('squads')

    // Enforce the "names are unique within a cycle" invariant on both paths,
    // using the same guard as the Scope Map rename UI (see squad-engine).
    const arr = squads.toArray().map((s: any) => ({
      id: getField(s, 'id'),
      name: getField(s, 'name'),
      color: getField(s, 'color'),
    }))
    if (isSquadNameTaken(arr, params.name, created ? undefined : id)) {
      nameTaken = true
      return
    }

    if (created) {
      const usedColors = arr.map((s: any) => s.color).filter(Boolean)
      const squad: Squad = {
        id,
        name: params.name,
        color: params.color ?? assignSquadColor(usedColors),
      }
      squads.push(new LiveObject(squad))
    } else {
      const existing = squads.find((s: any) => getField(s, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('name', params.name)
      if (params.color) existing.set('color', params.color)
    }
  })

  if (nameTaken) throw new Error(`Squad name already in use: "${params.name}"`)
  if (notFound) throw new Error(`Squad not found: "${id}"`)
  return { created, id }
}

export async function deleteSquad(roomId: string, id: string): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const squads = root.get('squads')
    const idx = squads.findIndex((s: any) => getField(s, 'id') === id)
    if (idx === -1) {
      notFound = true
      return
    }
    squads.delete(idx)

    // Unassign every pitch that referenced this squad → Unassigned.
    const pitches = root.get('pitches')
    for (const p of pitches) {
      if (getField(p, 'squadId') === id) p.delete('squadId')
    }
  })

  if (notFound) throw new Error(`Squad not found: "${id}"`)
}

// ── Scope ──

export async function upsertScope(
  roomId: string,
  params: {
    id?: string
    pitchId: string
    title: string
    tier: string
    // Partial-update fields: undefined = leave unchanged (on update) / fall back
    // on create. Must NOT be coerced to a default before this point — doing so
    // wipes litmus / resets hill_progress to 0 on a partial update.
    litmus_text?: string
    hill_progress?: number
    // Partial-update flag for the pitch's Core Scope pointer (see ADR 0012):
    // true steals, false clears only if this scope is currently core, undefined
    // = leave unchanged. Translated into the parent pitch's core_scope_id below.
    core?: boolean
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let pitchMissing = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')
    const scopes = root.get('scopes')
    let parentPitchId: string | undefined

    if (created) {
      const pitchExists = pitches.find(
        (p: any) => getField(p, 'id') === params.pitchId
      )
      if (!pitchExists) {
        pitchMissing = true
        return
      }
      const scope: CycleScope = {
        id,
        pitchId: params.pitchId,
        title: params.title,
        tier: params.tier as CycleScope['tier'],
        litmus_text: params.litmus_text ?? '',
        hill_progress: params.hill_progress ?? 0,
      }
      scopes.push(new LiveObject(scope))
      parentPitchId = params.pitchId
    } else {
      const existing = scopes.find((s: any) => getField(s, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('title', params.title)
      existing.set('tier', params.tier)
      if (params.litmus_text !== undefined) existing.set('litmus_text', params.litmus_text)
      if (params.hill_progress !== undefined) existing.set('hill_progress', params.hill_progress)
      parentPitchId = getField(existing, 'pitchId')
    }

    // Core Scope is stored as a pointer on the pitch (ADR 0012), but set at the
    // scope level. true steals; false clears only if this scope is the current
    // core; omitted leaves it untouched (partial-update, ADR 0011).
    if (params.core !== undefined && parentPitchId !== undefined) {
      const pitch = pitches.find(
        (p: any) => getField(p, 'id') === parentPitchId
      )
      if (pitch) {
        if (params.core) {
          pitch.set('core_scope_id', id)
        } else if (getField(pitch, 'core_scope_id') === id) {
          pitch.delete('core_scope_id')
        }
      }
    }
  })

  if (pitchMissing) throw new Error(`Pitch not found: "${params.pitchId}"`)
  if (notFound) throw new Error(`Scope not found: "${id}"`)
  return { created, id }
}

// ── Task ──

export async function upsertTask(
  roomId: string,
  params: {
    id?: string
    scopeId: string
    title: string
    // Partial-update field: undefined = leave unchanged (on update) / false on
    // create. Must NOT be coerced to false before this point — that would silently
    // un-complete a task on a title-only update.
    done?: boolean
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let scopeMissing = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const scopes = root.get('scopes')
    const tasks = root.get('tasks')

    if (created) {
      const scopeExists = scopes.find(
        (s: any) => getField(s, 'id') === params.scopeId
      )
      if (!scopeExists) {
        scopeMissing = true
        return
      }
      const task: ScopeTask = {
        id,
        scopeId: params.scopeId,
        title: params.title,
        done: params.done ?? false,
      }
      tasks.push(new LiveObject(task))
    } else {
      const existing = tasks.find((t: any) => getField(t, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('title', params.title)
      if (params.done !== undefined) existing.set('done', params.done)
    }
  })

  if (scopeMissing) throw new Error(`Scope not found: "${params.scopeId}"`)
  if (notFound) throw new Error(`Task not found: "${id}"`)
  return { created, id }
}

// ── Parking Item ──

export async function upsertParkingItem(
  roomId: string,
  params: {
    id?: string
    pitchId: string
    text: string
    // Partial-update field: undefined = leave unchanged (on update) / false on
    // create. Must NOT be coerced to false before this point — that would silently
    // un-resolve an item on a text-only update.
    resolved?: boolean
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let pitchMissing = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')
    const parkingItems = root.get('parkingItems')

    if (created) {
      const pitchExists = pitches.find(
        (p: any) => getField(p, 'id') === params.pitchId
      )
      if (!pitchExists) {
        pitchMissing = true
        return
      }
      const item: ParkingItem = {
        id,
        pitchId: params.pitchId,
        text: params.text,
        resolved: params.resolved ?? false,
      }
      parkingItems.push(new LiveObject(item))
    } else {
      const existing = parkingItems.find((p: any) => getField(p, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('text', params.text)
      if (params.resolved !== undefined) existing.set('resolved', params.resolved)
    }
  })

  if (pitchMissing) throw new Error(`Pitch not found: "${params.pitchId}"`)
  if (notFound) throw new Error(`Parking item not found: "${id}"`)
  return { created, id }
}

// ── Updates ──

// Append a needle update and denormalize the pitch's `needle` to its snapshot,
// mirroring the client `pushUpdate` mutation in scope-map.tsx. The `built`
// update is produced by the pure `buildUpdate` engine; any slack_attempted flag
// already set on it is persisted as-is.
export async function pushUpdate(
  roomId: string,
  built: PitchUpdate
): Promise<void> {
  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    root.get('updates').push(new LiveObject(built))
    const pitch = root
      .get('pitches')
      .find((p: any) => getField(p, 'id') === built.pitchId)
    if (pitch) {
      pitch.set('needle', {
        progress: built.needle_snapshot.progress,
        zone: built.needle_snapshot.zone,
      })
    }
  })
}

// Stamp the delivery timestamp on an update once Slack confirms receipt — the
// server-side twin of the client `markSlackDelivered` mutation.
export async function markSlackDelivered(
  roomId: string,
  updateId: string,
  deliveredAt: string
): Promise<void> {
  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const update = root
      .get('updates')
      .find((u: any) => getField(u, 'id') === updateId)
    if (update) update.set('slack_delivered_at', deliveredAt)
  })
}

// ── Deletes ──

export async function deletePitch(roomId: string, pitchId: string): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')
    const idx = pitches.findIndex((p: any) => getField(p, 'id') === pitchId)
    if (idx === -1) {
      notFound = true
      return
    }
    pitches.delete(idx)
  })

  if (notFound) throw new Error(`Pitch not found: "${pitchId}"`)
}

export async function deleteScope(roomId: string, scopeId: string): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const scopes = root.get('scopes')
    const tasks = root.get('tasks')
    const pitches = root.get('pitches')

    const idx = scopes.findIndex((s: any) => getField(s, 'id') === scopeId)
    if (idx === -1) {
      notFound = true
      return
    }
    const pitchId = getField(scopes.find((s: any) => getField(s, 'id') === scopeId), 'pitchId')
    scopes.delete(idx)

    // Cascade delete tasks belonging to this scope
    const taskArray = [...tasks]
    for (let i = taskArray.length - 1; i >= 0; i--) {
      if (getField(taskArray[i], 'scopeId') === scopeId) {
        tasks.delete(i)
      }
    }

    // Keep the Core Scope pointer clean: if this scope was the pitch's core,
    // clear it in the same operation (ADR 0012, no auto-promotion — the team
    // deliberately picks a new heart, so the empty-state banner reappears).
    if (pitchId !== undefined) {
      const pitch = pitches.find((p: any) => getField(p, 'id') === pitchId)
      if (pitch && getField(pitch, 'core_scope_id') === scopeId) {
        pitch.delete('core_scope_id')
      }
    }
  })

  if (notFound) throw new Error(`Scope not found: "${scopeId}"`)
}

export async function deleteTask(roomId: string, taskId: string): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const tasks = root.get('tasks')
    const idx = tasks.findIndex((t: any) => getField(t, 'id') === taskId)
    if (idx === -1) {
      notFound = true
      return
    }
    tasks.delete(idx)
  })

  if (notFound) throw new Error(`Task not found: "${taskId}"`)
}

// Delete the latest needle update on a pitch — the misfire-undo escape hatch
// (see ADR 0006). Refuses any update that isn't the latest for its pitch, since
// only the latest is deletable. Reverts the pitch's denormalized needle to the
// prior update's snapshot (or null if it was the only one); live scope hill
// positions are left untouched, and the needle Ghost / Hill Trails rebase off
// the now-latest update through pure derivation.
export async function deleteUpdate(roomId: string, updateId: string): Promise<void> {
  let notFound = false
  let notLatest = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const updates = root.get('updates')
    const idx = updates.findIndex((u: any) => getField(u, 'id') === updateId)
    if (idx === -1) {
      notFound = true
      return
    }

    const target = updates.get ? updates.get(idx) : [...updates][idx]
    const pitchId = getField(target, 'pitchId')

    // Latest-only: the target must be the newest update for its pitch.
    const all = [...updates] as any[]
    const latestForPitch = all
      .filter((u) => getField(u, 'pitchId') === pitchId)
      .reduce((a, b) =>
        getField(a, 'posted_at') > getField(b, 'posted_at') ? a : b
      )
    if (getField(latestForPitch, 'id') !== updateId) {
      notLatest = true
      return
    }

    // Compute the revert target from the full list before removing the row.
    const asUpdates: PitchUpdate[] = all.map((u) => ({
      id: getField(u, 'id'),
      pitchId: getField(u, 'pitchId'),
      posted_at: getField(u, 'posted_at'),
      needle_snapshot: getField(u, 'needle_snapshot'),
    })) as PitchUpdate[]
    const revertedNeedle = needleAfterDeletingLatest(asUpdates, pitchId, updateId)

    updates.delete(idx)

    const pitch = root
      .get('pitches')
      .find((p: any) => getField(p, 'id') === pitchId)
    if (pitch) pitch.set('needle', revertedNeedle)
  })

  if (notFound) throw new Error(`Update not found: "${updateId}"`)
  if (notLatest)
    throw new Error(
      `Only the latest update can be deleted: "${updateId}" is not the latest update for its pitch`
    )
}

export async function deleteParkingItem(
  roomId: string,
  itemId: string
): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const parkingItems = root.get('parkingItems')
    const idx = parkingItems.findIndex((p: any) => getField(p, 'id') === itemId)
    if (idx === -1) {
      notFound = true
      return
    }
    parkingItems.delete(idx)
  })

  if (notFound) throw new Error(`Parking item not found: "${itemId}"`)
}
