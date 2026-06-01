import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/node'
import { liveblocks } from '@/lib/liveblocks'
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  ParkingItem,
  PitchUpdate,
} from '@/cycle-liveblocks.config'
import { needleAfterDeletingLatest } from '@/lib/needle-engine'

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
    slack_channel: string
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
      slack_channel: params.slack_channel,
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
          slack_channel: params.slack_channel,
        },
      },
      pitches: { liveblocksType: 'LiveList', data: [] },
      scopes: { liveblocksType: 'LiveList', data: [] },
      tasks: { liveblocksType: 'LiveList', data: [] },
      updates: { liveblocksType: 'LiveList', data: [] },
      parkingItems: { liveblocksType: 'LiveList', data: [] },
    },
  })

  return { created: true }
}

// Items pushed correctly are LiveObjects (use .get/.set).
// If a list also contains plain objects pushed by buggy older code, treat them
// as read-only and access fields directly so iteration doesn't crash.
function getField(item: any, key: string): any {
  return typeof item?.get === 'function' ? item.get(key) : item?.[key]
}


// ── Pitch ──

export async function upsertPitch(
  roomId: string,
  params: {
    id?: string
    title: string
    stage: string
    frame_problem: string
    frame_outcome: string
    timebox_start: string
    timebox_end: string
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')

    if (created) {
      const pitch: CyclePitch = {
        id,
        title: params.title,
        stage: params.stage as CyclePitch['stage'],
        needle: null,
        frame_problem: params.frame_problem,
        frame_outcome: params.frame_outcome,
        timebox_start: params.timebox_start,
        timebox_end: params.timebox_end,
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
      existing.set('frame_problem', params.frame_problem)
      existing.set('frame_outcome', params.frame_outcome)
      existing.set('timebox_start', params.timebox_start)
      existing.set('timebox_end', params.timebox_end)
    }
  })

  if (notFound) throw new Error(`Pitch not found: "${id}"`)
  return { created, id }
}

// ── Scope ──

export async function upsertScope(
  roomId: string,
  params: {
    id?: string
    pitchId: string
    title: string
    tier: string
    litmus_text: string
    hill_progress: number
  }
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let pitchMissing = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const pitches = root.get('pitches')
    const scopes = root.get('scopes')

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
        litmus_text: params.litmus_text,
        hill_progress: params.hill_progress,
      }
      scopes.push(new LiveObject(scope))
    } else {
      const existing = scopes.find((s: any) => getField(s, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('title', params.title)
      existing.set('tier', params.tier)
      existing.set('litmus_text', params.litmus_text)
      existing.set('hill_progress', params.hill_progress)
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
    done: boolean
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
        done: params.done,
      }
      tasks.push(new LiveObject(task))
    } else {
      const existing = tasks.find((t: any) => getField(t, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('title', params.title)
      existing.set('done', params.done)
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
    resolved: boolean
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
        resolved: params.resolved,
      }
      parkingItems.push(new LiveObject(item))
    } else {
      const existing = parkingItems.find((p: any) => getField(p, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }
      existing.set('text', params.text)
      existing.set('resolved', params.resolved)
    }
  })

  if (pitchMissing) throw new Error(`Pitch not found: "${params.pitchId}"`)
  if (notFound) throw new Error(`Parking item not found: "${id}"`)
  return { created, id }
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

    const idx = scopes.findIndex((s: any) => getField(s, 'id') === scopeId)
    if (idx === -1) {
      notFound = true
      return
    }
    scopes.delete(idx)

    // Cascade delete tasks belonging to this scope
    const taskArray = [...tasks]
    for (let i = taskArray.length - 1; i >= 0; i--) {
      if (getField(taskArray[i], 'scopeId') === scopeId) {
        tasks.delete(i)
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
