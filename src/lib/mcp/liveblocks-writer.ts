import { nanoid } from 'nanoid'
import { LiveObject, LiveList } from '@liveblocks/node'
import { liveblocks } from '@/lib/liveblocks'
import type {
  CyclePitch,
  CycleScope,
  ScopeTask,
  ParkingItem,
  PitchUpdate,
  Squad,
} from '@/cycle-liveblocks.config'
import type {
  Area,
  Frame,
  FramePointer,
  FrameReport,
  PointerKind,
} from '@/product-map-liveblocks.config'
import {
  DEFAULT_KIND,
  FRAME_KINDS,
  FRAME_TYPES,
  POINTER_KINDS,
  POINTER_KIND_LABELS,
  isFrameKind,
  isFrameType,
  isPointerKind,
} from '@/lib/product-map-engine'
import { getTeamToday } from '@/lib/team-time'
import { needleAfterDeletingLatest } from '@/lib/needle-engine'
import { moveTargetIndex, isCardStatus, CARD_STATUSES } from '@/lib/card-engine'
import {
  assignSquadColor,
  resolveSquadByName,
  squadKey,
  isSquadNameTaken,
} from '@/lib/squad-engine'

type UpsertResult = { created: boolean; id: string; warning?: string }

// Dual-mode storage seam. Standalone (injectedRoot omitted) each writer opens
// its own mutateStorage — a full-doc load + flush. In batch mode the caller
// (openBatch) already holds one mutateStorage open and passes its `root`, so the
// writer mutates that directly and skips opening a second one. This is what lets
// handleBatch coalesce N ops into a single load/flush instead of N.
async function withRoot(
  roomId: string,
  injectedRoot: any,
  fn: (root: any) => void
): Promise<void> {
  if (injectedRoot) {
    fn(injectedRoot)
    return
  }
  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => fn(root))
}

// Open one mutateStorage for a whole batch; `fn` runs every op against the
// shared root (pass it as each writer's injectedRoot). One load, one flush.
export async function openBatch(
  roomId: string,
  fn: (root: any) => Promise<void>
): Promise<void> {
  await liveblocks.mutateStorage(roomId, ({ root }: { root: any }) => fn(root))
}

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
  params: Partial<CycleFields> & { archived?: boolean }
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
    // Archive is a stored boolean, orthogonal to the date-derived phase (ADR
    // 0019). Guarded like every other field so omitting it leaves it unchanged.
    if (params.archived !== undefined) c.set('archived', params.archived)
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
  // Metadata is string-valued (read cheaply by the list/landing without opening
  // the room), so archived rides as 'true'/'false'; the reader parses === 'true'.
  if (params.archived !== undefined) metadata.archived = String(params.archived)
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


// Rooms created before squads existed have no `squads` list in root storage,
// so root.get('squads') is undefined and reads on it throw. Lazily backfill it.
function getSquadList(root: any): any {
  if (!root.get('squads')) root.set('squads', new LiveList([]))
  // Read back so we return the attached instance (the one with .map/.push),
  // not the detached LiveList we just constructed.
  return root.get('squads')
}

// Resolve a squad name to an id within the cycle's squad list, creating the
// squad (with an auto-assigned color) when no case-insensitive match exists.
function resolveOrCreateSquadId(squads: any, name: string): string {
  const arr = squads.map((s: any) => ({
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
    // Pitch view (see ADR 0018). undefined = leave unchanged / default on create.
    view?: 'scope_map' | 'kanban'
    // The Frame on the Product Map this shape attacks (ADR 0022). '' clears it.
    // Writing it never touches the frame: the shape points at the frame, not
    // the reverse.
    frame_id?: string
  },
  injectedRoot?: any
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  // Resulting timebox after this write — needed to detect the Kanban-mode
  // override below. Kanban MODE is derived from the timebox (ADR 0018): a pitch
  // with no timebox_start/timebox_end renders as a board regardless of `view`,
  // so a `view: 'scope_map'` request on such a pitch stores fine but shows
  // nothing. We capture the effective values inside the mutation and warn after.
  let resultStart = ''
  let resultEnd = ''

  await withRoot(roomId, injectedRoot, (root: any) => {
    const pitches = root.get('pitches')
    const squads = getSquadList(root)

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
        ...(params.view ? { view: params.view } : {}),
        ...(params.frame_id ? { frame_id: params.frame_id } : {}),
      }
      resultStart = pitch.timebox_start
      resultEnd = pitch.timebox_end
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
      if (params.view !== undefined) existing.set('view', params.view)
      setOrClear(existing, 'frame_id', params.frame_id)
      resultStart = getField(existing, 'timebox_start') ?? ''
      resultEnd = getField(existing, 'timebox_end') ?? ''
      // squadId: null = clear (remove key), string = assign, undefined = leave.
      if (squadId === null) existing.delete('squadId')
      else if (squadId !== undefined) existing.set('squadId', squadId)
    }
  })

  if (notFound) throw new Error(`Pitch not found: "${id}"`)

  // Kanban-MODE override warning (ADR 0018): the write succeeded and `view` is
  // stored, but a scope_map view can't render on a pitch with no timebox — mode
  // (derived from the timebox) wins over the stored view. Surface this so the
  // caller isn't left wondering why the pitch is still a board.
  const hasTimebox = Boolean(resultStart && resultEnd)
  const warning =
    params.view === 'scope_map' && !hasTimebox
      ? 'view was set to "scope_map" but this pitch has no timebox (timebox_start/timebox_end), so it renders as a Kanban board regardless of view (Kanban mode, ADR 0018). Set timebox_start and timebox_end to make it render as a Scope Map.'
      : undefined

  return { created, id, ...(warning ? { warning } : {}) }
}

// ── Squad ──

export async function upsertSquad(
  roomId: string,
  params: {
    id?: string
    name: string
    color?: string
  },
  injectedRoot?: any
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let nameTaken = false

  await withRoot(roomId, injectedRoot, (root: any) => {
    const squads = getSquadList(root)

    // Enforce the "names are unique within a cycle" invariant on both paths,
    // using the same guard as the Scope Map rename UI (see squad-engine).
    const arr = squads.map((s: any) => ({
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

export async function deleteSquad(
  roomId: string,
  id: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false

  await withRoot(roomId, injectedRoot, (root: any) => {
    const squads = getSquadList(root)
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
    notes?: string
    hill_progress?: number
    // Partial-update flag for the pitch's Core Scope pointer (see ADR 0012):
    // true steals, false clears only if this scope is currently core, undefined
    // = leave unchanged. Translated into the parent pitch's core_scope_id below.
    core?: boolean
  },
  injectedRoot?: any
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let pitchMissing = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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
        // Only stored when given: an absent key is the "no notes" state, so a
        // create without notes doesn't plant an empty string on every scope.
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
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
      if (params.notes !== undefined) existing.set('notes', params.notes)
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

// The `batch` tool hands writer params through un-validated (`z.record`), so a
// tool's zod enum is NOT a guarantee down here. An unknown status would persist
// and then take the board down for the whole room on the next render, so every
// writer that stores one checks it at the door — the single point every entry
// path (standalone tool, batch op) goes through.
function assertCardStatus(status: unknown): void {
  if (status === undefined || isCardStatus(status)) return
  throw new Error(
    `Invalid status "${String(status)}" — use one of: ${CARD_STATUSES.join(', ')}`
  )
}

export async function upsertTask(
  roomId: string,
  params: {
    id?: string
    // A card belongs to a scope OR (when unscoped/triage) directly to a pitch
    // (see ADR 0018). On create, pass exactly one. Both optional on update.
    // On update, either one RE-PARENTS the card: a scopeId moves it into that
    // scope (triage → scoped), a pitchId moves it back to Unscoped/triage, and
    // scopeId: '' unscopes it onto the pitch it already belongs to. Passing both
    // on an update is rejected — a card has one parent.
    scopeId?: string
    pitchId?: string
    // Partial-update field like the rest: required on create, undefined on
    // update = leave the title unchanged (so re-parenting or assigning a card
    // needn't resend its title).
    title?: string
    // Partial-update field: undefined = leave unchanged (on update) / false on
    // create. Must NOT be coerced to false before this point — that would silently
    // un-complete a task on a title-only update.
    done?: boolean
    // Kanban column (see ADR 0018). undefined = leave unchanged. Setting it keeps
    // `done` in sync (done === status 'done').
    status?: 'todo' | 'doing' | 'done'
    // Resolved Clerk userId to assign. Partial-update like done:
    //   undefined = leave unchanged, '' = unassign (delete the key),
    //   a userId = assign. Caller resolves email/userId → userId first.
    assigneeId?: string
  },
  injectedRoot?: any
): Promise<UpsertResult> {
  assertCardStatus(params.status)

  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let scopeMissing = false
  let pitchMissing = false
  let badParent = false
  let twoParents = false
  let noTitle = false
  let noPitchToFallBackOn = false

  await withRoot(roomId, injectedRoot, (root: any) => {
    const scopes = root.get('scopes')
    const pitches = root.get('pitches')
    const tasks = root.get('tasks')

    if (created) {
      if (!params.scopeId === !params.pitchId) {
        // need exactly one of scopeId / pitchId
        badParent = true
        return
      }
      if (params.scopeId) {
        if (!scopes.find((s: any) => getField(s, 'id') === params.scopeId)) {
          scopeMissing = true
          return
        }
      } else if (!pitches.find((p: any) => getField(p, 'id') === params.pitchId)) {
        pitchMissing = true
        return
      }
      if (params.title === undefined) {
        noTitle = true
        return
      }
      const status = params.status
      const task: ScopeTask = {
        id,
        title: params.title,
        done: status ? status === 'done' : params.done ?? false,
        ...(params.scopeId ? { scopeId: params.scopeId } : { pitchId: params.pitchId }),
        ...(status ? { status } : {}),
      }
      if (params.assigneeId) task.assigneeId = params.assigneeId
      tasks.push(new LiveObject(task))
    } else {
      const existing = tasks.find((t: any) => getField(t, 'id') === id)
      if (!existing) {
        notFound = true
        return
      }

      // Re-parenting is resolved and validated BEFORE anything is written:
      // bailing out mid-way would leave the title changed and the parent not.
      let reparent: (() => void) | null = null
      if (params.scopeId !== undefined && params.pitchId !== undefined) {
        twoParents = true
        return
      }
      if (params.scopeId !== undefined) {
        if (params.scopeId === '') {
          // '' unscopes the card: it becomes a triage card on the pitch it
          // already belongs to — its own pitchId, or (legacy tasks, which
          // predate pitchId) the pitch its current scope hangs off.
          const currentScopeId = getField(existing, 'scopeId')
          const currentScope = currentScopeId
            ? scopes.find((s: any) => getField(s, 'id') === currentScopeId)
            : undefined
          const pitchId =
            getField(existing, 'pitchId') ??
            (currentScope ? getField(currentScope, 'pitchId') : undefined)
          if (!pitchId) {
            noPitchToFallBackOn = true
            return
          }
          reparent = () => {
            existing.set('pitchId', pitchId)
            existing.delete('scopeId')
          }
        } else {
          const scope = scopes.find((s: any) => getField(s, 'id') === params.scopeId)
          if (!scope) {
            scopeMissing = true
            return
          }
          // Keep pitchId in step with the scope's own pitch, so a re-parented
          // card can never claim a different board than the scope it sits in.
          const scopePitchId = getField(scope, 'pitchId')
          reparent = () => {
            existing.set('scopeId', params.scopeId)
            if (scopePitchId) existing.set('pitchId', scopePitchId)
          }
        }
      } else if (params.pitchId !== undefined) {
        if (!pitches.find((p: any) => getField(p, 'id') === params.pitchId)) {
          pitchMissing = true
          return
        }
        reparent = () => {
          existing.set('pitchId', params.pitchId)
          existing.delete('scopeId')
        }
      }

      reparent?.()
      if (params.title !== undefined) existing.set('title', params.title)
      // Status is the source of truth in Kanban view; keep done in sync.
      if (params.status !== undefined) {
        existing.set('status', params.status)
        existing.set('done', params.status === 'done')
      } else if (params.done !== undefined) {
        existing.set('done', params.done)
      }
      if (params.assigneeId !== undefined) {
        // '' clears to Unassigned — DELETE the key (set(undefined) would leave
        // the old value resolving, same trap as core_scope_id).
        if (params.assigneeId === '') existing.delete('assigneeId')
        else existing.set('assigneeId', params.assigneeId)
      }
    }
  })

  if (badParent)
    throw new Error('Pass exactly one of "scopeId" or "pitchId" when creating a task')
  if (twoParents)
    throw new Error('Pass at most one of "scopeId" or "pitchId" when re-parenting a task')
  if (noTitle) throw new Error('"title" is required when creating a task')
  if (noPitchToFallBackOn)
    throw new Error(`Task "${id}" has no pitch to unscope onto — pass "pitchId" instead`)
  if (scopeMissing) throw new Error(`Scope not found: "${params.scopeId}"`)
  if (pitchMissing) throw new Error(`Pitch not found: "${params.pitchId}"`)
  if (notFound) throw new Error(`Task not found: "${id}"`)
  return { created, id }
}

// The MCP twin of dragging a card on the board (see ADR 0018): move a task to a
// Kanban column (`status`) and/or to a position relative to a sibling
// (`before`/`after`). Position in the flat tasks list IS priority — there is no
// order field — so a reprioritise is a LiveList.move against an anchor, exactly
// like the in-app drag. At least one of status/before/after must be given, and
// before/after are mutually exclusive.
//
// `moved` reports whether the card's POSITION changed, so an agent can tell
// "already there" from "done something" — it is false, not an error, when the
// card already sat next to its anchor (or when only the column was set).
// `status` echoes the column when one was set.
export async function moveTask(
  roomId: string,
  params: {
    id: string
    status?: 'todo' | 'doing' | 'done'
    before?: string
    after?: string
  },
  injectedRoot?: any
): Promise<{ moved: boolean; status?: 'todo' | 'doing' | 'done' }> {
  assertCardStatus(params.status)

  const hasBefore = !!params.before
  const hasAfter = !!params.after
  if (hasBefore && hasAfter) {
    throw new Error('Pass at most one of "before" or "after" (a sibling task id)')
  }
  if (!hasBefore && !hasAfter && params.status === undefined) {
    throw new Error('Pass "status" and/or one of "before"/"after" (a sibling task id)')
  }
  const anchorId = params.after ?? params.before

  let notFound = false
  let anchorMissing = false
  let foreignAnchor = false
  let moved = false

  await withRoot(roomId, injectedRoot, (root: any) => {
    const tasks = root.get('tasks')
    const scopes = root.get('scopes')
    const task = tasks.find((t: any) => getField(t, 'id') === params.id)
    if (!task) {
      notFound = true
      return
    }
    if (anchorId !== undefined) {
      const anchor = tasks.find((t: any) => getField(t, 'id') === anchorId)
      if (!anchor) {
        // Nothing has been touched yet, so a bad anchor is a clean no-op.
        anchorMissing = true
        return
      }
      // Order is one cycle-wide list, so a cross-pitch anchor is silently
      // meaningless: the move lands the card next to a card its own board never
      // shows. Reject it rather than report success for a nonsense position.
      const pitch = resolveTaskPitchId(task, scopes)
      const anchorPitch = resolveTaskPitchId(anchor, scopes)
      if (pitch && anchorPitch && pitch !== anchorPitch) {
        foreignAnchor = true
        return
      }
      if (params.status !== undefined) setCardStatus(task, params.status)
      const from = tasks.findIndex((t: any) => getField(t, 'id') === params.id)
      const anchorIdx = tasks.findIndex((t: any) => getField(t, 'id') === anchorId)
      const to = moveTargetIndex(from, anchorIdx, hasAfter ? 'after' : 'before')
      if (to !== from) {
        tasks.move(from, to)
        moved = true
      }
    } else if (params.status !== undefined) {
      setCardStatus(task, params.status)
    }
  })

  if (notFound) throw new Error(`Task not found: "${params.id}"`)
  if (anchorMissing) throw new Error(`Anchor task not found: "${anchorId}"`)
  if (foreignAnchor)
    throw new Error(
      `Anchor task "${anchorId}" belongs to a different pitch — anchor against a card on the same board`
    )
  return { moved, ...(params.status !== undefined ? { status: params.status } : {}) }
}

// A card's pitch: set directly on Unscoped/triage cards, otherwise derived from
// its scope (see ADR 0018). Undefined for legacy data carrying neither — those
// skip the sibling check rather than being blocked by it.
function resolveTaskPitchId(task: any, scopes: any): string | undefined {
  const scopeId = getField(task, 'scopeId')
  if (!scopeId) return getField(task, 'pitchId') as string | undefined
  const scope = scopes.find((s: any) => getField(s, 'id') === scopeId)
  return scope ? (getField(scope, 'pitchId') as string | undefined) : undefined
}

// Status is the source of truth for a card's column; legacy `done` is kept in
// sync so done-counts and update snapshots stay correct (see ADR 0018).
function setCardStatus(task: any, status: 'todo' | 'doing' | 'done') {
  task.set('status', status)
  task.set('done', status === 'done')
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
  },
  injectedRoot?: any
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false
  let pitchMissing = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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

export async function deletePitch(
  roomId: string,
  pitchId: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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

export async function deleteScope(
  roomId: string,
  scopeId: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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

export async function deleteTask(
  roomId: string,
  taskId: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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
export async function deleteUpdate(
  roomId: string,
  updateId: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false
  let notLatest = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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
  itemId: string,
  injectedRoot?: any
): Promise<void> {
  let notFound = false

  await withRoot(roomId, injectedRoot, (root: any) => {
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

// ── Product Map ──

// The Product Map room is org-scoped and sits outside the cycle rooms (ADR 0021).
// An org that has never captured a frame has no room yet, and an agent must not
// have to create one by hand, so the first write brings it into being.
async function ensureProductMapRoom(roomId: string): Promise<void> {
  if (await roomExists(roomId)) return
  await liveblocks.createRoom(roomId, { defaultAccesses: ['room:write'] })
  await liveblocks.initializeStorageDocument(roomId, {
    liveblocksType: 'LiveObject',
    data: {
      areas: { liveblocksType: 'LiveList', data: [] },
      frames: { liveblocksType: 'LiveList', data: [] },
    },
  })
}

type AreaFields = {
  name: string
  parentAreaId: string
  x: number
  y: number
  owner: string
}

/**
 * Create or partial-update an area. Every non-identity field is optional:
 * undefined = omitted = leave unchanged (ADR 0011).
 *
 * `x` and `y` are a grid position, not pixels — the app generates the area's
 * shape from them. A create with no position lands on the next free grid slot,
 * so an agent that cannot draw still gets an area that does not sit on another.
 */
export async function upsertArea(
  roomId: string,
  params: { id?: string } & Partial<AreaFields>
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false

  if (created && !params.name?.trim()) {
    throw new Error('A new area needs a name.')
  }
  if (params.name !== undefined && !params.name.trim()) {
    throw new Error('An area name cannot be blank. Omit the field to leave the name unchanged.')
  }
  // An area inside itself has no shape and no meaning.
  if (params.parentAreaId && params.parentAreaId === id) {
    throw new Error('An area cannot be its own parent.')
  }

  await ensureProductMapRoom(roomId)

  await withRoot(roomId, undefined, (root: any) => {
    const areas = root.get('areas')

    if (created) {
      // `.map` is the only read the node LiveList offers.
      const slot = nextFreeGridSlot(areas.map((a: any) => ({ x: getField(a, 'x'), y: getField(a, 'y') })))
      const area: Area = {
        id,
        name: (params.name as string).trim(),
        x: params.x ?? slot.x,
        y: params.y ?? slot.y,
        ...(params.parentAreaId ? { parentAreaId: params.parentAreaId } : {}),
        ...(params.owner ? { owner: params.owner } : {}),
      }
      areas.push(new LiveObject(area))
      return
    }

    const existing = areas.find((a: any) => getField(a, 'id') === id)
    if (!existing) {
      notFound = true
      return
    }
    // Guard every field: an omitted field is never coerced away.
    // '' clears an OPTIONAL field. A name is not optional, so a blank one would
    // leave an area nobody can identify — omit the field to leave it alone.
    if (params.name !== undefined) existing.set('name', params.name)
    if (params.x !== undefined) existing.set('x', params.x)
    if (params.y !== undefined) existing.set('y', params.y)
    setOrClear(existing, 'parentAreaId', params.parentAreaId)
    setOrClear(existing, 'owner', params.owner)
  })

  if (notFound) throw new Error(`Area not found: "${id}"`)
  return { created, id }
}

/** Three across, then wrap. Enough to keep new areas off each other. */
const AREA_GRID_COLUMNS = 3

/**
 * The first slot nothing sits on, reading three across then wrapping. Counting
 * the areas instead would collide with any area the caller positioned by hand,
 * and two areas on one slot draw exactly on top of each other.
 */
function nextFreeGridSlot(taken: { x: unknown; y: unknown }[]): { x: number; y: number } {
  const occupied = new Set(taken.map((a) => `${a.x},${a.y}`))
  for (let i = 0; ; i++) {
    const slot = { x: i % AREA_GRID_COLUMNS, y: Math.floor(i / AREA_GRID_COLUMNS) }
    if (!occupied.has(`${slot.x},${slot.y}`)) return slot
  }
}

type FrameFields = {
  kind: Frame['kind']
  type: Frame['type']
  problem: string
  appetite: string
  business_case: string
  areaId: string
  owner: string
  originFrameId: string
}

/**
 * Create or partial-update a frame. Every non-identity field is optional:
 * undefined = omitted = leave unchanged (ADR 0011). Capture needs a problem and
 * a Type and nothing else, so the rest fall back to empty on create.
 *
 * `reports`, `pointers`, `last_woken` and `resolved` are NOT writable here.
 * They belong to the tools that own them (attach_report, link_pointer, wake,
 * resolve), which is what keeps an upsert from erasing a frame's history.
 */
export async function upsertFrame(
  roomId: string,
  params: { id?: string } & Partial<FrameFields>
): Promise<UpsertResult> {
  const id = params.id ?? nanoid()
  const created = !params.id
  let notFound = false

  // Validate the two vocabularies HERE, not only at the tool schema. The writer
  // is the shared seam every path goes through, and a Kind or Type outside the
  // vocabulary would break the pin color and the playbook lookup downstream.
  if (params.kind !== undefined && !isFrameKind(params.kind)) {
    throw new Error(`Invalid kind: "${params.kind}". One of: ${FRAME_KINDS.join(', ')}.`)
  }
  if (params.type !== undefined && !isFrameType(params.type)) {
    throw new Error(`Invalid type: "${params.type}". One of: ${FRAME_TYPES.join(', ')}.`)
  }
  if (created && params.type === undefined) {
    throw new Error(`A new frame needs a type. One of: ${FRAME_TYPES.join(', ')}.`)
  }
  // Narrowed above; held in a local so the check survives into the closure.
  const newType = params.type as Frame['type']

  await ensureProductMapRoom(roomId)

  await withRoot(roomId, undefined, (root: any) => {
    const frames = root.get('frames')

    if (created) {
      // Every frame wants an owner: somebody has to care that it gets
      // addressed. The area owner is the default the app suggests, and nothing
      // more — the capturer can change it. The in-app capture form does the
      // same, so an agent capture is not left ownerless (#221).
      const owner = params.owner || areaOwner(root, params.areaId)
      const frame: Frame = {
        id,
        kind: params.kind ?? DEFAULT_KIND,
        type: newType,
        problem: params.problem ?? '',
        appetite: params.appetite ?? '',
        business_case: params.business_case ?? '',
        ...(params.areaId ? { areaId: params.areaId } : {}),
        ...(owner ? { owner } : {}),
        ...(params.originFrameId ? { originFrameId: params.originFrameId } : {}),
        reports: [],
        pointers: [],
        // A frame is born awake. Its clock starts on the day it was captured.
        last_woken: getTeamToday(new Date()),
        resolved: false,
      }
      frames.push(new LiveObject(frame))
      return
    }

    const existing = frames.find((f: any) => getField(f, 'id') === id)
    if (!existing) {
      notFound = true
      return
    }
    // undefined = omitted = leave unchanged. Guard every field explicitly, so an
    // omitted field is never coerced away (the timebox-nullification incident).
    if (params.kind !== undefined) existing.set('kind', params.kind)
    if (params.type !== undefined) existing.set('type', params.type)
    if (params.problem !== undefined) existing.set('problem', params.problem)
    if (params.appetite !== undefined) existing.set('appetite', params.appetite)
    if (params.business_case !== undefined) existing.set('business_case', params.business_case)
    // '' clears an optional pointer field; the key goes away rather than
    // sitting there as an empty string nobody can tell from "unset".
    setOrClear(existing, 'areaId', params.areaId)
    setOrClear(existing, 'owner', params.owner)
    setOrClear(existing, 'originFrameId', params.originFrameId)
  })

  if (notFound) throw new Error(`Frame not found: "${id}"`)
  return { created, id }
}

/**
 * Attach a report to a frame. A report is one record of the problem happening,
 * and it is the only thing that grows a pin.
 *
 * This writes exactly two fields: the report goes onto the list, and the wake
 * clock resets. Nothing else on the frame is read or rewritten, so a report can
 * never erase the problem, the appetite, the pointers or the owner.
 *
 * A new report is one of the three things that wake a frame (ADR 0024).
 */
export async function attachReport(
  roomId: string,
  params: {
    frameId: string
    capturer: string
    source?: FrameReport['source']
    customer?: string
    link?: string
    text: string
    date?: string
  }
): Promise<{ frameId: string; reportCount: number }> {
  if (!params.text.trim()) {
    throw new Error('A report needs text — one line saying what happened.')
  }
  if (params.source !== undefined && params.source !== 'internal' && params.source !== 'customer') {
    throw new Error(`Invalid source: "${params.source}". One of: internal, customer.`)
  }

  let notFound = false
  let reportCount = 0
  // Two different dates. The report carries the day the problem happened, so a
  // support person can record last week's call. The wake carries the day
  // somebody reported it, which is now — reporting an old incident is a fresh
  // mention, and must never age the frame towards Dormant (ADR 0024).
  const today = getTeamToday(new Date())
  const reportedOn = params.date?.trim() || today

  await withRoot(roomId, undefined, (root: any) => {
    const existing = root.get('frames').find((f: any) => getField(f, 'id') === params.frameId)
    if (!existing) {
      notFound = true
      return
    }
    const report: FrameReport = {
      capturer: params.capturer,
      // Internal is the quieter claim, so it is the safe default: a report only
      // counts under the customer lens when somebody said it came from one.
      source: params.source ?? 'internal',
      ...(params.customer?.trim() ? { customer: params.customer.trim() } : {}),
      ...(params.link?.trim() ? { link: params.link.trim() } : {}),
      text: params.text.trim(),
      date: reportedOn,
    }
    const reports = (getField(existing, 'reports') ?? []) as FrameReport[]
    existing.set('reports', [...reports, report])
    existing.set('last_woken', today)
    reportCount = reports.length + 1
  })

  if (notFound) throw new Error(`Frame not found: "${params.frameId}"`)
  return { frameId: params.frameId, reportCount }
}

/**
 * Attach a pointer to a frame. A frame packages pointers; the artifact stays
 * where it lives, so the Product Map never becomes a second copy that drifts.
 *
 * This writes ONE field: the pointer list. It does not wake the frame, because
 * only three things do and filing a link is not one of them (ADR 0024).
 */
export async function linkPointer(
  roomId: string,
  params: { frameId: string; url: string; kind: PointerKind; label?: string }
): Promise<{ frameId: string; pointerCount: number }> {
  if (!params.url.trim()) {
    throw new Error('A pointer needs a url — the artifact lives at the other end of it.')
  }
  if (!isPointerKind(params.kind)) {
    throw new Error(
      `Invalid pointer kind: "${params.kind}". One of: ${POINTER_KINDS.join(', ')}.`
    )
  }

  let notFound = false
  let pointerCount = 0

  await withRoot(roomId, undefined, (root: any) => {
    const existing = root.get('frames').find((f: any) => getField(f, 'id') === params.frameId)
    if (!existing) {
      notFound = true
      return
    }
    const pointer: FramePointer = {
      url: params.url.trim(),
      // A pointer with no label still needs something to click. The kind is the
      // honest fallback, and a caller can rename it later.
      label: params.label?.trim() || POINTER_KIND_LABELS[params.kind],
      kind: params.kind,
    }
    const pointers = (getField(existing, 'pointers') ?? []) as FramePointer[]
    existing.set('pointers', [...pointers, pointer])
    pointerCount = pointers.length + 1
  })

  if (notFound) throw new Error(`Frame not found: "${params.frameId}"`)
  return { frameId: params.frameId, pointerCount }
}

/**
 * Wake a frame. This writes ONE field, the freshness clock, and it must never
 * erase a frame: the problem, the appetite, the reports, the pointers and the
 * owner all stay exactly as they were.
 *
 * A wake is a mention. It carries no note, because a wake with evidence behind
 * it is a Report — use attachReport for that (ADR 0024).
 */
export async function wakeFrame(
  roomId: string,
  params: { frameId: string; date?: string }
): Promise<{ frameId: string; wokenOn: string }> {
  const mentionedOn = params.date?.trim() || getTeamToday(new Date())
  let notFound = false
  let wokenOn = mentionedOn

  await withRoot(roomId, undefined, (root: any) => {
    const existing = root.get('frames').find((f: any) => getField(f, 'id') === params.frameId)
    if (!existing) {
      notFound = true
      return
    }
    // The clock only ever moves forward. An agent replaying older table notes
    // must never age a frame that something more recent already woke, so a
    // back-dated mention is recorded as a no-op rather than a regression.
    // ISO dates compare lexically, the same trick the cycle list engine uses.
    const current = String(getField(existing, 'last_woken') ?? '')
    if (current && current >= mentionedOn) {
      wokenOn = current
      return
    }
    existing.set('last_woken', mentionedOn)
  })

  if (notFound) throw new Error(`Frame not found: "${params.frameId}"`)
  return { frameId: params.frameId, wokenOn }
}

/**
 * Resolve a frame, because a person decided the problem is gone. Only a person
 * does this. Nothing resolves on a timer, and shipping something never silently
 * claims the pain is over (ADR 0025).
 *
 * This writes ONE field. A resolved frame is not deleted: it leaves the Product Map and
 * stays on its area, with the shapes that resolved it. Pass `resolved: false`
 * to put it back.
 */
export async function resolveFrame(
  roomId: string,
  params: { frameId: string; resolved?: boolean }
): Promise<{ frameId: string; resolved: boolean }> {
  const resolved = params.resolved ?? true
  let notFound = false

  await withRoot(roomId, undefined, (root: any) => {
    const existing = root.get('frames').find((f: any) => getField(f, 'id') === params.frameId)
    if (!existing) {
      notFound = true
      return
    }
    existing.set('resolved', resolved)
  })

  if (notFound) throw new Error(`Frame not found: "${params.frameId}"`)
  return { frameId: params.frameId, resolved }
}

/** The owner of the area a frame is filed in, or '' when there is none to suggest. */
function areaOwner(root: any, areaId: string | undefined): string {
  if (!areaId) return ''
  const areas = root.get('areas')
  if (!areas) return ''
  const area = areas.find((a: any) => getField(a, 'id') === areaId)
  return area ? String(getField(area, 'owner') ?? '') : ''
}

function setOrClear(item: any, key: string, value: string | undefined): void {
  if (value === undefined) return
  if (value === '') item.delete(key)
  else item.set(key, value)
}
