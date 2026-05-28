import { nanoid } from 'nanoid'
import { liveblocks } from '@/lib/liveblocks'
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  ParkingItem,
} from '@/cycle-liveblocks.config'

type UpsertResult = { created: boolean; id: string }


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
      pitches.push(pitch)
    } else {
      const existing = pitches.find((p: any) => p.get('id') === id)
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
        (p: any) => p.get('id') === params.pitchId
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
      scopes.push(scope)
    } else {
      const existing = scopes.find((s: any) => s.get('id') === id)
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
        (s: any) => s.get('id') === params.scopeId
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
      tasks.push(task)
    } else {
      const existing = tasks.find((t: any) => t.get('id') === id)
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
        (p: any) => p.get('id') === params.pitchId
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
      parkingItems.push(item)
    } else {
      const existing = parkingItems.find((p: any) => p.get('id') === id)
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
    const idx = pitches.findIndex((p: any) => p.get('id') === pitchId)
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

    const idx = scopes.findIndex((s: any) => s.get('id') === scopeId)
    if (idx === -1) {
      notFound = true
      return
    }
    scopes.delete(idx)

    // Cascade delete tasks belonging to this scope
    const taskArray = [...tasks]
    for (let i = taskArray.length - 1; i >= 0; i--) {
      if (taskArray[i].get('scopeId') === scopeId) {
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
    const idx = tasks.findIndex((t: any) => t.get('id') === taskId)
    if (idx === -1) {
      notFound = true
      return
    }
    tasks.delete(idx)
  })

  if (notFound) throw new Error(`Task not found: "${taskId}"`)
}

export async function deleteParkingItem(
  roomId: string,
  itemId: string
): Promise<void> {
  let notFound = false

  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => {
    const parkingItems = root.get('parkingItems')
    const idx = parkingItems.findIndex((p: any) => p.get('id') === itemId)
    if (idx === -1) {
      notFound = true
      return
    }
    parkingItems.delete(idx)
  })

  if (notFound) throw new Error(`Parking item not found: "${itemId}"`)
}
