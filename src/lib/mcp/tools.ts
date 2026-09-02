import { z } from 'zod'
import { listCycleRooms, getCycleStorage, resolvePitch, getProductMapStorage } from './liveblocks-reader'
import { STAGES, readStage } from '@/lib/stage-engine'
import { parseSlugPath, isValidSlugSegment } from './slug-path'
import { resolveOrg, type OrgMembership } from './auth'
import { slugify } from '@/lib/slugify'
import { derivePitchCards } from '@/lib/mission-control-helpers'
import { deriveTotalTaskProgress, resolveCoreScopeId } from '@/lib/scope-map-helpers'
import { deriveBoardCards } from '@/lib/card-engine'
import { buildUpdate } from '@/lib/update-engine'
import { computeTimebox } from '@/lib/timebox-engine'
import { normalizeEmoji, validateNotionUrl } from '@/lib/pitch-identity-engine'
import { formatSlackMessage, type SlackMessageParams } from '@/lib/slack-message'
import { deliverSlackUpdate, isSlackConfigured } from '@/lib/slack-delivery'
import { getSlackWebhookUrl } from '@/lib/calendar/org-integrations'
import { diffHillTrail, noChangeStreaks, summarizeMovement } from '@/lib/hill-trail-engine'
import { resolveOrigin } from './origin'
import { productMapRoomId } from '@/product-map-liveblocks.config'
import { FRAME_KINDS, FRAME_TYPES } from '@/lib/product-map-engine'
import type { Zone, Needle, CardStatus, Stage } from '@/cycle-liveblocks.config'
import {
  createCycle,
  updateCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
  moveTask,
  upsertParkingItem,
  deletePitch,
  deleteScope,
  deleteTask,
  deleteParkingItem,
  deleteUpdate,
  pushUpdate,
  markSlackDelivered,
  upsertSquad,
  deleteSquad,
  openBatch,
  upsertArea,
  upsertFrame,
} from './liveblocks-writer'
import {
  getOrganizationUsers,
  resolveAssigneeRef,
  type OrganizationUser,
} from '@/lib/users'

const orgArg = {
  org: z
    .string()
    .optional()
    .describe(
      'Organization slug. Optional when the user belongs to a single org; required otherwise.'
    ),
}

const slugPathArg = {
  slug_path: z
    .string()
    .describe('Slug path, e.g. "2026-q2-build" or "2026-q2-build/mission-control"'),
}

type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: true
}

type ToolExtra = { authInfo?: { extra?: Record<string, unknown> } }

function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function getMemberships(extra: ToolExtra): OrgMembership[] {
  const memberships = extra.authInfo?.extra?.memberships
  if (!Array.isArray(memberships) || memberships.length === 0) {
    throw new Error('Missing org memberships in authInfo')
  }
  return memberships as OrgMembership[]
}

function getUserId(extra: ToolExtra): string {
  const userId = extra.authInfo?.extra?.userId
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Missing userId in authInfo')
  }
  return userId
}

export async function handleCreateCycle(
  orgId: string,
  userId: string,
  slugInput: string | undefined,
  params: {
    name: string
    type: string
    start_date: string
    end_date: string
  }
): Promise<ToolResult> {
  // Use an explicit slug if given, otherwise derive one from the name.
  const slug = slugInput?.trim() ? slugInput.trim() : slugify(params.name)
  if (!isValidSlugSegment(slug)) {
    return errorResult(
      `Could not derive a valid cycle slug from "${slugInput ?? params.name}". ` +
        'Pass a "slug" of lowercase letters, digits, "-" or "_".'
    )
  }
  const roomId = `${orgId}:cycle:${slug}`
  try {
    const result = await createCycle(roomId, userId, params)
    if (!result.created) {
      return errorResult(`Cycle already exists: "${slug}"`)
    }
    return jsonResult({ created: true, slug, name: params.name })
  } catch (err) {
    return errorResult((err as Error).message)
  }
}

export async function handleUpdateCycle(
  orgId: string,
  cycleSlug: string,
  params: {
    name?: string
    type?: string
    start_date?: string
    end_date?: string
  }
): Promise<ToolResult> {
  const roomId = `${orgId}:cycle:${cycleSlug}`
  try {
    const result = await updateCycle(roomId, params)
    return jsonResult({ updated: true, slug: cycleSlug, cycle: result.cycle })
  } catch (err) {
    return errorResult((err as Error).message)
  }
}

// Reversible archive (ADR 0019): flips the stored `archived` flag via the same
// cycle writer. Not a delete — nothing is destroyed, and it round-trips.
export async function handleArchiveCycle(
  orgId: string,
  cycleSlug: string,
  archived: boolean
): Promise<ToolResult> {
  const roomId = `${orgId}:cycle:${cycleSlug}`
  try {
    await updateCycle(roomId, { archived })
    return jsonResult({ updated: true, slug: cycleSlug, archived })
  } catch (err) {
    return errorResult((err as Error).message)
  }
}

export async function handleListCycles(orgId: string): Promise<ToolResult> {
  const rooms = await listCycleRooms(orgId)
  return jsonResult(rooms)
}

export async function handleListCyclesAllOrgs(
  memberships: OrgMembership[]
): Promise<ToolResult> {
  const perOrg = await Promise.all(
    memberships.map(async (m) => ({
      org: m.slug,
      cycles: await listCycleRooms(m.id),
    }))
  )
  return jsonResult(perOrg)
}

export async function handleGetCycle(
  orgId: string,
  cycleSlug: string
): Promise<ToolResult> {
  try {
    const storage = await getCycleStorage(orgId, cycleSlug)
    const pitchCards = derivePitchCards(
      storage.pitches,
      storage.scopes,
      storage.tasks,
      storage.updates
    )
    // Resolve each pitch's squad name (null when unassigned or dangling).
    const squads = storage.squads ?? []
    const squadNameById = new Map(squads.map((s) => [s.id, s.name]))
    const squadIdByPitch = new Map(
      storage.pitches.map((p) => [p.id, p.squadId])
    )
    const pitchesWithSquad = pitchCards.map((card) => {
      const squadId = squadIdByPitch.get(card.id)
      return {
        ...card,
        squad: (squadId && squadNameById.get(squadId)) ?? null,
      }
    })
    return jsonResult({
      cycle: storage.cycle,
      squads,
      pitches: pitchesWithSquad,
    })
  } catch {
    return errorResult(`Cycle not found: "${cycleSlug}"`)
  }
}

export async function handleGetPitch(
  orgId: string,
  cycleSlug: string,
  pitchSlug: string
): Promise<ToolResult> {
  try {
    const storage = await getCycleStorage(orgId, cycleSlug)
    const pitch = resolvePitch(storage, pitchSlug)
    if (!pitch) return errorResult(`Pitch not found: "${pitchSlug}" in cycle "${cycleSlug}"`)

    const pitchScopes = storage.scopes.filter((s) => s.pitchId === pitch.id)
    // Resolve the pitch's Core Scope pointer against its live scopes (ADR 0012):
    // a pointer to a since-deleted scope resolves to "no core set", so the read
    // surface never advertises a ghost core.
    const coreId = resolveCoreScopeId(pitch.core_scope_id, pitchScopes)
    const scopes = pitchScopes.map((scope) => ({
      ...scope,
      core: scope.id === coreId,
      tasks: storage.tasks.filter((t) => t.scopeId === scope.id),
    }))

    const parkingItems = storage.parkingItems.filter(
      (p) => p.pitchId === pitch.id
    )

    // The Kanban board (see ADR 0018): the pitch's cards as one flat list in
    // priority order — top of a column is highest — including Unscoped (triage)
    // cards, which `scopes[].tasks` cannot show. Reprioritise with move_task.
    const cards = deriveBoardCards(storage.tasks, pitchScopes, pitch.id)

    return jsonResult({
      pitch: { ...pitch, core_scope_id: coreId },
      scopes,
      cards,
      parkingItems,
    })
  } catch {
    return errorResult(`Cycle not found: "${cycleSlug}"`)
  }
}

export async function handleListUpdates(
  orgId: string,
  cycleSlug: string,
  pitchSlug: string
): Promise<ToolResult> {
  try {
    const storage = await getCycleStorage(orgId, cycleSlug)
    const pitch = resolvePitch(storage, pitchSlug)
    if (!pitch) return errorResult(`Pitch not found: "${pitchSlug}" in cycle "${cycleSlug}"`)

    const updates = storage.updates
      .filter((u) => u.pitchId === pitch.id)
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())

    return jsonResult({ pitchTitle: pitch.title, updates })
  } catch {
    return errorResult(`Cycle not found: "${cycleSlug}"`)
  }
}

// ── Post / preview update ──

type UpdateInput = { progress: number; zone: Zone; narrative: string }

// Shared context both preview and post resolve from current storage: the live
// task rollup, the timebox-derived week/days-left, and the Slack params (minus
// postedAt, which each caller stamps — post uses the built update's timestamp).
function resolveUpdateContext(
  storage: Awaited<ReturnType<typeof getCycleStorage>>,
  pitch: {
    id: string
    title: string
    emoji: string
    timebox_start: string
    timebox_end: string
    needle: Needle | null
  },
  orgSlug: string,
  cycleSlug: string,
  input: UpdateInput
) {
  const pitchScopes = storage.scopes.filter((s) => s.pitchId === pitch.id)
  const pitchTasks = storage.tasks.filter((t) =>
    pitchScopes.some((s) => s.id === t.scopeId)
  )
  const today = new Date().toISOString().slice(0, 10)
  const timebox = computeTimebox(pitch.timebox_start, pitch.timebox_end, today)
  const totals = deriveTotalTaskProgress(storage.scopes, storage.tasks, pitch.id)
  const pitchUrl = `${resolveOrigin()}/${orgSlug}/cycles/${cycleSlug}/${slugify(pitch.title)}`

  // Hill movement, framed against the previous update — mirrors the app so an
  // MCP-posted update reads the same in Slack. Baseline at 0% on the first one.
  const pitchUpdates = storage.updates.filter((u) => u.pitchId === pitch.id)
  const latestUpdate = pitchUpdates.length
    ? pitchUpdates.reduce((a, b) => (a.posted_at > b.posted_at ? a : b))
    : null
  const scopesForDiff = pitchScopes.map((s) => ({ id: s.id, hill_progress: s.hill_progress }))
  const baselineSnapshot = latestUpdate
    ? latestUpdate.hill_snapshot
    : pitchScopes.map((s) => ({
        scopeId: s.id,
        hill_progress: 0,
        title: s.title,
        tier: s.tier,
      }))
  const trails = scopesForDiff.length ? diffHillTrail(baselineSnapshot, scopesForDiff) : []
  const snapshotsNewestFirst = [...pitchUpdates]
    .sort((a, b) => (a.posted_at > b.posted_at ? -1 : 1))
    .map((u) => u.hill_snapshot)
  const movement = summarizeMovement(
    trails,
    noChangeStreaks(snapshotsNewestFirst, scopesForDiff),
    new Map(pitchScopes.map((s) => [s.id, s.title]))
  )

  const slackParams = (postedAt: string): SlackMessageParams => ({
    pitchTitle: pitch.title,
    pitchEmoji: pitch.emoji ?? '',
    weekNumber: timebox.currentWeek,
    totalWeeks: timebox.totalWeeks,
    zone: input.zone,
    previousZone: pitch.needle?.zone ?? null,
    authorName: 'Cycles',
    narrative: input.narrative,
    movement,
    needleProgress: input.progress,
    previousNeedleProgress: pitch.needle?.progress ?? null,
    daysLeft: timebox.daysLeft,
    pitchUrl,
    postedAt,
  })

  return { pitchScopes, pitchTasks, timebox, totals, pitchUrl, slackParams }
}

export async function handlePreviewUpdate(
  orgId: string,
  orgSlug: string,
  cycleSlug: string,
  pitchSlug: string,
  input: UpdateInput
): Promise<ToolResult> {
  let storage: Awaited<ReturnType<typeof getCycleStorage>>
  try {
    storage = await getCycleStorage(orgId, cycleSlug)
  } catch {
    return errorResult(`Cycle not found: "${cycleSlug}"`)
  }
  const pitch = resolvePitch(storage, pitchSlug)
  if (!pitch) return errorResult(`Pitch not found: "${pitchSlug}" in cycle "${cycleSlug}"`)

  const ctx = resolveUpdateContext(storage, pitch, orgSlug, cycleSlug, input)
  const postedAt = new Date().toISOString()
  const slack_text = formatSlackMessage(ctx.slackParams(postedAt)).text
  const webhookUrl = await getSlackWebhookUrl(orgId)

  return jsonResult({
    slack_text,
    would_deliver: isSlackConfigured(webhookUrl),
    resolved: {
      weekNumber: ctx.timebox.currentWeek,
      totalWeeks: ctx.timebox.totalWeeks,
      tasksDone: ctx.totals.done,
      tasksTotal: ctx.totals.total,
      daysLeft: ctx.timebox.daysLeft,
      pitch_url: ctx.pitchUrl,
    },
  })
}

export async function handlePostUpdate(
  orgId: string,
  orgSlug: string,
  cycleSlug: string,
  pitchSlug: string,
  userId: string,
  input: UpdateInput
): Promise<ToolResult> {
  let storage: Awaited<ReturnType<typeof getCycleStorage>>
  try {
    storage = await getCycleStorage(orgId, cycleSlug)
  } catch {
    return errorResult(`Cycle not found: "${cycleSlug}"`)
  }
  const pitch = resolvePitch(storage, pitchSlug)
  if (!pitch) return errorResult(`Pitch not found: "${pitchSlug}" in cycle "${cycleSlug}"`)

  const ctx = resolveUpdateContext(storage, pitch, orgSlug, cycleSlug, input)
  const roomId = `${orgId}:cycle:${cycleSlug}`

  const built = buildUpdate({
    pitchId: pitch.id,
    userId,
    progress: input.progress,
    zone: input.zone,
    narrative: input.narrative,
    currentNeedle: pitch.needle,
    scopes: ctx.pitchScopes.map((s) => ({
      id: s.id,
      hill_progress: s.hill_progress,
      title: s.title,
      tier: s.tier,
    })),
    tasks: ctx.pitchTasks.map((t) => ({ scopeId: t.scopeId, done: t.done })),
    timebox: {
      daysLeft: ctx.timebox.daysLeft,
      currentWeek: ctx.timebox.currentWeek,
      totalWeeks: ctx.timebox.totalWeeks,
    },
  })

  // Mark the intent to deliver before persisting, mirroring the app's
  // markSlackAttempted → deliver → markSlackDelivered sequence.
  const webhookUrl = await getSlackWebhookUrl(orgId)
  const enabled = isSlackConfigured(webhookUrl)
  if (enabled) built.slack_attempted = true

  try {
    await pushUpdate(roomId, built)
  } catch (err) {
    return errorResult((err as Error).message)
  }

  // Slack failure is non-fatal — the update is already persisted.
  let slack: 'delivered' | 'failed' | 'disabled' = 'disabled'
  if (enabled) {
    const result = await deliverSlackUpdate(ctx.slackParams(built.posted_at), webhookUrl)
    if (result.ok) {
      await markSlackDelivered(roomId, built.id, result.delivered_at)
      slack = 'delivered'
    } else {
      slack = 'failed'
    }
  }

  return jsonResult({
    update_id: built.id,
    needle: { progress: built.needle_snapshot.progress, zone: built.needle_snapshot.zone },
    slack,
  })
}

// ── Write tool handlers ──

// Pre-writer normalization: the work a write tool does to its raw params before
// the writer sees them (resolving an assignee ref to a userId, normalizing an
// emoji, validating a Notion URL). It lives here, not in a tool handler, because
// `batch` forwards params straight from the client — anything done only in a
// handler is silently skipped on the batch path. That bites hardest with
// `assignee`: the writer takes `assigneeId`, so an unresolved `assignee` is not
// an error there, it's an omitted field — the op reports success having assigned
// nobody. Both paths go through these.
type WriteParams = Record<string, any>
type UsersProvider = () => Promise<OrganizationUser[]>

// undefined = leave unchanged; '' = unassign. Anything else must match a member
// by email or userId — a ref that doesn't is rejected, never silently dropped.
async function resolveAssigneeId(ref: string, users: UsersProvider): Promise<string> {
  if (ref.trim() === '') return ''
  const match = resolveAssigneeRef(ref, await users())
  if (!match) {
    throw new Error(
      `No org member matches assignee "${ref}" (use an email or userId — see list_members)`
    )
  }
  return match
}

function preparePitchParams(params: WriteParams): WriteParams {
  const prepared = { ...params }
  // Only normalize a field that was actually supplied, so an omitted field is
  // never coerced to '' (ADR 0011).
  if (params.emoji !== undefined) prepared.emoji = normalizeEmoji(params.emoji)
  // The batch path skips this tool's zod enum, so normalize here too: a caller
  // passing the stage ADR 0023 removed gets `shaping`, never a stored `framing`.
  if (params.stage !== undefined) prepared.stage = readStage(params.stage as string)
  if (params.notion_url !== undefined) {
    const notion = validateNotionUrl(params.notion_url)
    prepared.notion_url = notion.isValidUrl ? notion.value : ''
  }
  return prepared
}

async function prepareWriteParams(
  tool: string,
  params: WriteParams,
  users: UsersProvider
): Promise<WriteParams> {
  if (tool === 'upsert_pitch') return preparePitchParams(params)
  if (tool === 'upsert_task' && params.assignee !== undefined) {
    const { assignee, ...rest } = params
    return { ...rest, assigneeId: await resolveAssigneeId(assignee, users) }
  }
  return params
}

type BatchOp = { tool: string; params: Record<string, unknown> }
type BatchResult =
  | {
      ok: true
      tool: string
      id?: string
      created?: boolean
      moved?: boolean
      status?: CardStatus
    }
  | { ok: false; tool: string; error: string }

// What a write tool reports back. A batched op's result must say as much as the
// standalone call does: an upsert answers "which entity, new or not", a move
// answers "did the position actually change" (see ADR 0018) — dropping that on
// the batch path would blind an agent re-ranking a whole board in one call,
// which is the reason move_task is batchable at all.
type WriteResult =
  | { created: boolean; id: string }
  | { moved: boolean; status?: CardStatus }
  | void

// Each handler takes the shared batch `root` (from openBatch's single
// mutateStorage) as its last arg, so every op in a batch mutates one loaded
// storage doc instead of opening its own load/flush.
const WRITE_TOOLS: Record<
  string,
  (roomId: string, params: any, root: any) => Promise<WriteResult>
> = {
  upsert_pitch: upsertPitch,
  upsert_scope: upsertScope,
  upsert_task: upsertTask,
  // Batchable so a whole board can be reprioritised in one load/flush — each
  // move sees the previous one's order (see ADR 0018).
  move_task: moveTask,
  upsert_parking_item: upsertParkingItem,
  upsert_squad: upsertSquad,
  delete_squad: (roomId, p, root) => deleteSquad(roomId, p.id, root).then(() => undefined),
  delete_pitch: (roomId, p, root) => deletePitch(roomId, p.id, root).then(() => undefined),
  delete_scope: (roomId, p, root) => deleteScope(roomId, p.id, root).then(() => undefined),
  delete_task: (roomId, p, root) => deleteTask(roomId, p.id, root).then(() => undefined),
  delete_parking_item: (roomId, p, root) => deleteParkingItem(roomId, p.id, root).then(() => undefined),
  undo_update: (roomId, p, root) => deleteUpdate(roomId, p.id, root).then(() => undefined),
  // archive_cycle / unarchive_cycle are deliberately NOT here: archiving also
  // writes room metadata (updateRoom), which can't ride the coalesced storage
  // batch (ADR 0019). They're standalone tools only.
}

export async function handleBatch(
  orgId: string,
  cycleSlug: string,
  operations: BatchOp[]
): Promise<ToolResult> {
  const roomId = `${orgId}:cycle:${cycleSlug}`
  const results: BatchResult[] = []

  // Normalize every op's params BEFORE opening the batch: preparation can hit
  // Clerk (resolving an assignee), and that must not happen while a
  // mutateStorage is held open. The member list is fetched at most once per
  // batch, however many ops assign someone.
  // Memoize the promise, not the resolved list: preparation runs concurrently,
  // so caching only the result would let every op fire its own fetch first.
  let orgUsers: Promise<OrganizationUser[]> | null = null
  const users: UsersProvider = () => (orgUsers ??= getOrganizationUsers(orgId))
  const prepared = await Promise.all(
    operations.map(async (op) => {
      try {
        return { ok: true as const, params: await prepareWriteParams(op.tool, op.params, users) }
      } catch (err) {
        return { ok: false as const, error: (err as Error).message }
      }
    })
  )

  // One mutateStorage for the whole batch: every op runs against the same loaded
  // root, in order, so later ops see earlier ones (create scope → create task)
  // and we pay a single load/flush instead of one per op.
  await openBatch(roomId, async (root) => {
    for (const [i, op] of operations.entries()) {
      const handler = WRITE_TOOLS[op.tool]
      if (!handler) {
        results.push({ ok: false, tool: op.tool, error: `Unknown tool: "${op.tool}"` })
        continue
      }
      const params = prepared[i]
      if (!params.ok) {
        results.push({ ok: false, tool: op.tool, error: params.error })
        continue
      }
      try {
        const result = await handler(roomId, params.params, root)
        // Forward whichever outcome the writer reports; a delete reports none.
        results.push({ ok: true, tool: op.tool, ...(result ?? {}) })
      } catch (err) {
        results.push({ ok: false, tool: op.tool, error: (err as Error).message })
      }
    }
  })

  return jsonResult({ results })
}

// ── Product Map handlers ──
//
// The Product Map is org-scoped and names no cycle (ADR 0021), so these take an
// org id where the cycle tools take a slug path. Their `map_` prefix is the only
// thing separating the two scopes in the tool list, so it never comes off.

export async function handleListAreas(orgId: string): Promise<ToolResult> {
  const { areas } = await getProductMapStorage(orgId)
  return jsonResult({ areas })
}

export async function handleUpsertArea(
  orgId: string,
  params: { id?: string; name?: string; parent_area_id?: string; x?: number; y?: number; owner?: string }
): Promise<ToolResult> {
  if (!params.id && !params.name?.trim()) {
    return errorResult('A new area needs a "name", for example "Integrations" or "Billing".')
  }
  try {
    const result = await upsertArea(productMapRoomId(orgId), {
      id: params.id,
      name: params.name,
      parentAreaId: params.parent_area_id,
      x: params.x,
      y: params.y,
      owner: params.owner,
    })
    return jsonResult(result)
  } catch (err) {
    return errorResult((err as Error).message)
  }
}

export async function handleListFrames(orgId: string): Promise<ToolResult> {
  const { frames } = await getProductMapStorage(orgId)
  return jsonResult({ frames })
}

export async function handleUpsertFrame(
  orgId: string,
  params: {
    id?: string
    kind?: string
    type?: string
    problem?: string
    appetite?: string
    business_case?: string
    area_id?: string
    owner?: string
    origin_frame_id?: string
  }
): Promise<ToolResult> {
  // Type decides the workflow, so a frame can never exist without one (ADR
  // 0025). There is no "unknown" Type to fall back on. A problem is the other
  // half of a capture: a frame with no problem records nothing.
  if (!params.id) {
    if (!params.type) {
      return errorResult(
        `A new frame needs a "type" — it selects the playbook. One of: ${FRAME_TYPES.join(', ')}.`
      )
    }
    if (!params.problem?.trim()) {
      return errorResult('A new frame needs a "problem" — one line saying what hurts.')
    }
  }

  try {
    const result = await upsertFrame(productMapRoomId(orgId), {
      id: params.id,
      kind: params.kind as never,
      type: params.type as never,
      problem: params.problem,
      appetite: params.appetite,
      business_case: params.business_case,
      areaId: params.area_id,
      owner: params.owner,
      originFrameId: params.origin_frame_id,
    })
    return jsonResult(result)
  } catch (err) {
    return errorResult((err as Error).message)
  }
}

// Every tool MUST declare annotations so MCP clients (e.g. Claude) can group it
// as read vs. write and render a sensible title. `defineTool` makes `annotations`
// a required argument — a new tool that omits it fails `yarn typecheck`.
type CyclesToolAnnotations = {
  /** Human-readable title shown in client UIs. */
  title: string
  /** true for query tools, false for anything that mutates storage. */
  readOnlyHint: boolean
  /** true when the tool can delete or overwrite existing data. */
  destructiveHint?: boolean
  /** true when calling repeatedly with the same args has no extra effect. */
  idempotentHint?: boolean
  /** Cycles tools only touch Liveblocks storage, so this is always false. */
  openWorldHint?: boolean
}

function defineTool(
  server: any,
  name: string,
  description: string,
  schema: Record<string, unknown>,
  annotations: CyclesToolAnnotations,
  cb: (args: any, extra: ToolExtra) => Promise<ToolResult>
): void {
  server.tool(name, description, schema, annotations, cb)
}

export function registerCyclesTools(server: any): void {
  defineTool(
    server,
    'list_cycles',
    'List cycles. With no "org" argument: lists cycles for the user\'s only org, or grouped by org if they belong to several.',
    orgArg,
    { title: 'List cycles', readOnlyHint: true, openWorldHint: false },
    async ({ org }: { org?: string }, extra: ToolExtra) => {
      const memberships = getMemberships(extra)
      if (!org && memberships.length > 1) {
        return handleListCyclesAllOrgs(memberships)
      }
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleListCycles(resolved.org.id)
    }
  )

  defineTool(
    server,
    'create_cycle',
    'Create a new cycle (a Liveblocks room). The slug is how the cycle is addressed by the other tools — omit it to derive one from the name (e.g. "2026 Q3 Build" → "2026-q3-build"), or pass an explicit slug of lowercase letters, digits, "-" or "_". Fails if a cycle with that slug already exists. After creating, use upsert_pitch to add pitches.',
    {
      ...orgArg,
      name: z.string().describe('Human-readable cycle name, e.g. "2026 Q3 Build".'),
      slug: z
        .string()
        .optional()
        .describe('Optional cycle slug (lowercase letters, digits, "-" or "_"). Defaults to a slug derived from the name.'),
      type: z.enum(['build', 'cooldown']).default('build'),
      start_date: z.string().default('').describe('ISO date (YYYY-MM-DD), or empty.'),
      end_date: z.string().default('').describe('ISO date (YYYY-MM-DD), or empty.'),
    },
    {
      title: 'Create cycle',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async (
      {
        org,
        slug,
        ...params
      }: {
        org?: string
        slug?: string
        name: string
        type: string
        start_date: string
        end_date: string
      },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleCreateCycle(resolved.org.id, getUserId(extra), slug, params)
    }
  )

  defineTool(
    server,
    'get_cycle',
    'Get cycle details with pitch summaries',
    { ...orgArg, ...slugPathArg },
    { title: 'Get cycle', readOnlyHint: true, openWorldHint: false },
    async (
      { org, slug_path }: { org?: string; slug_path: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      return handleGetCycle(resolved.org.id, parsed.cycleSlug)
    }
  )

  defineTool(
    server,
    'update_cycle',
    'Update an existing cycle\'s top-level fields, addressed by slug. The slug itself is immutable. Updates are PARTIAL: any field you omit (name, type, start_date, end_date) is left unchanged — only fields you pass are overwritten. Pass "" to clear a date. Fails if no cycle with that slug exists.',
    {
      ...orgArg,
      ...slugPathArg,
      // All optional with NO .default() — omitting a field must leave it
      // unchanged, never coerce it to '' (the timebox-nullification incident).
      name: z.string().optional().describe('Human-readable cycle name. Omit to leave unchanged.'),
      type: z.enum(['build', 'cooldown']).optional().describe('Cycle type. Omit to leave unchanged.'),
      start_date: z.string().optional().describe('ISO date (YYYY-MM-DD). Pass "" to clear; omit to leave unchanged.'),
      end_date: z.string().optional().describe('ISO date (YYYY-MM-DD). Pass "" to clear; omit to leave unchanged.'),
    },
    {
      title: 'Update cycle',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      {
        org,
        slug_path,
        ...params
      }: {
        org?: string
        slug_path: string
        name?: string
        type?: string
        start_date?: string
        end_date?: string
      },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      return handleUpdateCycle(resolved.org.id, parsed.cycleSlug, params)
    }
  )

  defineTool(
    server,
    'archive_cycle',
    'Archive a cycle, addressed by slug: remove it from the Cycles list and from default-landing resolution WITHOUT deleting anything. Reversible — call unarchive_cycle to restore it. Use this to get rid of a cycle created by mistake; there is deliberately no way to permanently delete a cycle (it would take all its pitches, scopes, tasks and updates with it). See ADR 0019.',
    { ...orgArg, ...slugPathArg },
    {
      title: 'Archive cycle',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, slug_path }: { org?: string; slug_path: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      return handleArchiveCycle(resolved.org.id, parsed.cycleSlug, true)
    }
  )

  defineTool(
    server,
    'unarchive_cycle',
    'Unarchive a cycle, addressed by slug: restore a previously archived cycle to the Cycles list and to landing/stepper resolution. Its date-derived phase (upcoming/current/past) is unchanged — it simply reappears where its dates place it. See ADR 0019.',
    { ...orgArg, ...slugPathArg },
    {
      title: 'Unarchive cycle',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, slug_path }: { org?: string; slug_path: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      return handleArchiveCycle(resolved.org.id, parsed.cycleSlug, false)
    }
  )

  defineTool(
    server,
    'get_pitch',
    'Get full pitch detail with scopes, tasks, and parking items. Also returns `cards`: the pitch\'s Kanban cards as one flat list in priority order (top of a column is highest), including Unscoped/triage cards that scopes[].tasks cannot show — reprioritise them with move_task.',
    { ...orgArg, ...slugPathArg },
    { title: 'Get pitch', readOnlyHint: true, openWorldHint: false },
    async (
      { org, slug_path }: { org?: string; slug_path: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handleGetPitch(resolved.org.id, parsed.cycleSlug, parsed.pitchSlug)
    }
  )

  defineTool(
    server,
    'list_updates',
    'Get update history for a pitch, newest first',
    { ...orgArg, ...slugPathArg },
    { title: 'List updates', readOnlyHint: true, openWorldHint: false },
    async (
      { org, slug_path }: { org?: string; slug_path: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handleListUpdates(resolved.org.id, parsed.cycleSlug, parsed.pitchSlug)
    }
  )

  const updateInputArgs = {
    progress: z
      .number()
      .min(0)
      .max(1)
      .describe('Needle position 0–1 (0 = just started, 1 = shipped).'),
    zone: z
      .enum(['on_track', 'some_risk', 'concerned'])
      .describe('How the team feels about the pitch right now.'),
    narrative: z
      .string()
      .min(1)
      .describe('What changed this week — shown verbatim in the update and Slack post.'),
  }

  defineTool(
    server,
    'preview_update',
    'Dry-run a needle update: returns the exact Slack message text that post_update would send, whether it would actually reach Slack (would_deliver), and the resolved week/task/days-left fields. Writes nothing and does not move the needle. Same arguments as post_update.',
    { ...orgArg, ...slugPathArg, ...updateInputArgs },
    { title: 'Preview update', readOnlyHint: true, openWorldHint: false },
    async (
      {
        org,
        slug_path,
        progress,
        zone,
        narrative,
      }: { org?: string; slug_path: string; progress: number; zone: Zone; narrative: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handlePreviewUpdate(resolved.org.id, resolved.org.slug, parsed.cycleSlug, parsed.pitchSlug, {
        progress,
        zone,
        narrative,
      })
    }
  )

  defineTool(
    server,
    'post_update',
    'Post a needle update for a pitch (the "move the needle" action): records the update, moves the pitch needle, snapshots hill/task progress, and — if a Slack webhook is configured — posts it to the channel. Slack delivery is best-effort: the update always persists even if Slack fails. Use preview_update first to see exactly what will be sent. Each call creates a new update; to undo a misfire (wrong pitch, fat-fingered position), call undo_update on the returned update_id (latest-only).',
    { ...orgArg, ...slugPathArg, ...updateInputArgs },
    {
      title: 'Post update',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      // The only Cycles tool that reaches an external service (Slack).
      openWorldHint: true,
    },
    async (
      {
        org,
        slug_path,
        progress,
        zone,
        narrative,
      }: { org?: string; slug_path: string; progress: number; zone: Zone; narrative: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handlePostUpdate(
        resolved.org.id,
        resolved.org.slug,
        parsed.cycleSlug,
        parsed.pitchSlug,
        getUserId(extra),
        { progress, zone, narrative }
      )
    }
  )

  // ── Write tools ──

  const cycleSlugArg = {
    cycle_slug: z.string().describe('Cycle slug, e.g. "2026-q2-build"'),
  }

  defineTool(
    server,
    'upsert_pitch',
    'Create or update a pitch. IMPORTANT: before creating, call get_cycle to check for an existing pitch with the same name — if one exists, pass its id to update it instead of creating a duplicate. Omit id to create (returns generated id). Provide id to update. Updates are PARTIAL: any field you omit (frame_problem, frame_outcome, timebox_start, timebox_end, emoji, notion_url, squad) is left unchanged — only fields you pass are overwritten.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional().describe('Pitch id. Omit to create.'),
      title: z.string(),
      // Derived from STAGES so the tool surface cannot drift from the engine
      // (ADR 0023 removed `framing`, which this now rejects).
      stage: z.enum(STAGES as [Stage, ...Stage[]]),
      // On update, these are PARTIAL: omit to leave a field unchanged. They must
      // stay optional (not .default('')) — a default would coerce an omitted
      // field to '' and silently wipe it on update (the timebox-nullification
      // incident). On create, the writer falls back to '' for any omitted field.
      frame_problem: z.string().optional(),
      frame_outcome: z.string().optional(),
      timebox_start: z.string().optional(),
      timebox_end: z.string().optional(),
      emoji: z
        .string()
        .optional()
        .describe('Identity emoji (single emoji). Anything else is ignored. Omit to leave unchanged.'),
      notion_url: z
        .string()
        .optional()
        .describe(
          'Outbound link to the pitch’s Notion doc. Must be a valid https URL or it is ignored. Omit to leave unchanged.'
        ),
      squad: z
        .string()
        .optional()
        .describe(
          'Squad NAME (not id) that owns this pitch. Matched case-insensitively and auto-created if it does not exist. Pass "" to clear the assignment; omit to leave it unchanged.'
        ),
      view: z
        .enum(['scope_map', 'kanban'])
        .optional()
        .describe(
          'How the pitch is rendered (see ADR 0018): "scope_map" (scopes/hill/needle) or "kanban" (card board). Omit to leave unchanged; defaults to scope_map on create. IMPORTANT: this toggle only takes effect on pitches that HAVE a timebox. A pitch with no timebox_start/timebox_end is in Kanban MODE and always renders as a board regardless of view — setting view:"scope_map" on it stores the value but shows nothing (the response returns a `warning` in that case). To get a Scope Map, also set timebox_start and timebox_end.'
        ),
    },
    {
      title: 'Create or update pitch',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; title: string; stage: string; frame_problem?: string; frame_outcome?: string; timebox_start?: string; timebox_end?: string; emoji?: string; notion_url?: string; squad?: string; view?: 'scope_map' | 'kanban' },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        // Same normalization the batch path applies — one implementation, so the
        // two entry points can't drift.
        const result = await upsertPitch(roomId, preparePitchParams(params) as typeof params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'upsert_scope',
    'Create or update a scope under a pitch. Omit id to create. Updates are PARTIAL: any field you omit (litmus_text, notes, hill_progress, core) is left unchanged — only fields you pass are overwritten.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      pitchId: z.string().describe('Parent pitch id'),
      title: z.string(),
      tier: z.enum(['must', 'should', 'could']),
      // Optional (not .default) so an omitted field is left unchanged on update
      // rather than wiped / reset to 0. Defaults to '' / 0 on create.
      litmus_text: z
        .string()
        .optional()
        .describe(
          'What it ships: ONE short line — if we only ship this scope, what does the user get? Keep it stable and headline-length; put anything longer in notes.'
        ),
      notes: z
        .string()
        .optional()
        .describe(
          'Free-form working notes for this scope — markdown, any length: context, decisions, links, open questions, findings. This is the place for detail — not litmus_text. Replaces the whole field, so pass the existing notes plus your additions when appending.'
        ),
      hill_progress: z.number().min(0).max(1).optional(),
      // Flag this scope as the pitch's Core Scope (the heart of the pitch; see
      // ADR 0012). true steals the core from any other scope; false clears it
      // only if this scope is currently core (a no-op otherwise); omit = leave
      // the pitch's core unchanged.
      core: z.boolean().optional(),
    },
    {
      title: 'Create or update scope',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; pitchId: string; title: string; tier: string; litmus_text?: string; notes?: string; hill_progress?: number; core?: boolean },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        const result = await upsertScope(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'upsert_task',
    'Create or update a task/card. Omit id to create. When creating, pass exactly one parent: scopeId (a normal task under a scope) OR pitchId (an Unscoped "triage" card, see ADR 0018). On an update, scopeId/pitchId RE-PARENT the card — this is how a triage card is assigned to a scope. Updates are PARTIAL: omit title/done/status/assignee/parent to leave them unchanged — passing only a new title will NOT un-complete or un-assign the task.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      scopeId: z
        .string()
        .optional()
        .describe(
          'Parent scope id. On create, pass this OR pitchId. On update, moves the card into this scope (triage → scoped); pass "" to unscope it back to triage.'
        ),
      pitchId: z
        .string()
        .optional()
        .describe(
          'Parent pitch id for an Unscoped/triage card (no scope). On create, pass this OR scopeId. On update, moves the card back to that pitch\'s triage tray.'
        ),
      // Optional (not required) so re-parenting or assigning an existing card
      // needn't resend its title. Required on create — enforced in the writer.
      title: z.string().optional().describe('Task title. Required when creating; omit on update to leave unchanged.'),
      // Optional (not .default) so a title-only update leaves done unchanged
      // rather than resetting it to false. Defaults to false on create.
      done: z.boolean().optional(),
      // Kanban column (see ADR 0018). Omit to leave unchanged; setting it keeps
      // `done` in sync. This is how a card is moved between columns over MCP.
      status: z
        .enum(['todo', 'doing', 'done'])
        .optional()
        .describe('Kanban column: todo | doing | done. Setting it keeps done in sync. Omit to leave unchanged.'),
      // The assignee, as an email or a Clerk userId (see list_members). Omit to
      // leave unchanged; pass "" to unassign. Resolved server-side; an unknown
      // ref is rejected. Display names are not accepted (ambiguous).
      assignee: z
        .string()
        .optional()
        .describe('Assignee email or userId; "" to unassign; omit to leave unchanged'),
    },
    {
      title: 'Create or update task',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, assignee, ...params }: { org?: string; cycle_slug: string; id?: string; scopeId?: string; pitchId?: string; title?: string; done?: boolean; status?: 'todo' | 'doing' | 'done'; assignee?: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`

      try {
        // Same resolution the batch path applies (see prepareWriteParams).
        const assigneeId =
          assignee === undefined
            ? undefined
            : await resolveAssigneeId(assignee, () =>
                getOrganizationUsers(resolved.org.id)
              )
        const result = await upsertTask(roomId, { ...params, assigneeId })
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'move_task',
    'Move a card on the Kanban board: its column (`status`) and/or its priority — the position within that column, where top is highest. Priority is the order itself (no priority field): pass `before`/`after` a sibling task id to reprioritise, exactly like dragging the card. Pass `status` and/or one of `before`/`after` (never both anchors); the anchor must be a card on the same pitch. Reads (get_pitch) return `cards` in priority order. Returns `moved: false` (not an error) when the card already sat in that position.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().describe('Id of the task to move'),
      status: z
        .enum(['todo', 'doing', 'done'])
        .optional()
        .describe('Kanban column to move the card to; keeps `done` in sync'),
      before: z
        .string()
        .optional()
        .describe('Place the task immediately before this sibling task id (higher priority than it)'),
      after: z
        .string()
        .optional()
        .describe('Place the task immediately after this sibling task id (lower priority than it)'),
    },
    {
      title: 'Move task',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async (
      {
        org,
        cycle_slug,
        ...params
      }: {
        org?: string
        cycle_slug: string
        id: string
        status?: 'todo' | 'doing' | 'done'
        before?: string
        after?: string
      },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        const result = await moveTask(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'list_members',
    "List the organization's members — their userId, name, and email — so you can assign tasks (see upsert_task's assignee).",
    { ...orgArg },
    {
      title: 'List members',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ org }: { org?: string }, extra: ToolExtra) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const users = await getOrganizationUsers(resolved.org.id)
      return jsonResult(
        users.map((u) => ({ userId: u.userId, name: u.name, email: u.email }))
      )
    }
  )

  defineTool(
    server,
    'upsert_parking_item',
    'Create or update a parking lot item under a pitch. Omit id to create. Updates are PARTIAL: omit resolved to leave it unchanged — passing only new text will NOT un-resolve the item.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      pitchId: z.string().describe('Parent pitch id'),
      text: z.string(),
      // Optional (not .default) so a text-only update leaves resolved unchanged
      // rather than resetting it to false. Defaults to false on create.
      resolved: z.boolean().optional(),
    },
    {
      title: 'Create or update parking item',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; pitchId: string; text: string; resolved?: boolean },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved2 = resolveOrg(memberships, org)
      if (!resolved2.ok) return errorResult(resolved2.error)
      const roomId = `${resolved2.org.id}:cycle:${cycle_slug}`
      try {
        const result = await upsertParkingItem(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'upsert_squad',
    'Create or update a squad (a per-cycle, named team that owns pitches). Omit id to create with an auto-assigned color (or pass an explicit color); provide id to rename/recolor. To assign a pitch to a squad, prefer passing squad by name to upsert_pitch — squads auto-create there too.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional().describe('Squad id. Omit to create.'),
      name: z.string(),
      color: z
        .string()
        .optional()
        .describe('Optional #rrggbb color. Auto-assigned from the palette when omitted on create.'),
    },
    {
      title: 'Create or update squad',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; name: string; color?: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        const result = await upsertSquad(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'delete_squad',
    'Delete a squad by id. Its pitches are unassigned (moved to Unassigned), not deleted.',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Squad id to delete') },
    {
      title: 'Delete squad',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deleteSquad(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true, id })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'delete_pitch',
    'Delete a pitch by id',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Pitch id to delete') },
    {
      title: 'Delete pitch',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deletePitch(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'delete_scope',
    'Delete a scope and its tasks by id',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Scope id to delete') },
    {
      title: 'Delete scope',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deleteScope(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'delete_task',
    'Delete a task by id',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Task id to delete') },
    {
      title: 'Delete task',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deleteTask(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'delete_parking_item',
    'Delete a parking lot item by id',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Parking item id to delete') },
    {
      title: 'Delete parking item',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deleteParkingItem(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'undo_update',
    'Undo the latest needle update on a pitch (a misfire undo — wrong pitch, fat-fingered position, duplicate post). Only the latest update for a pitch can be undone; passing any older update fails. Reverts the pitch needle to the prior update (or unset if it was the only one). Does not remove the Slack message that was posted.',
    { ...orgArg, ...cycleSlugArg, id: z.string().describe('Update id to undo (must be the latest update for its pitch)') },
    {
      title: 'Undo latest update',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, id }: { org?: string; cycle_slug: string; id: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      try {
        await deleteUpdate(`${resolved.org.id}:cycle:${cycle_slug}`, id)
        return jsonResult({ deleted: true })
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'batch',
    'Execute multiple write operations sequentially. Each operation specifies a tool and params. Returns results for all operations — successful ops persist even if others fail. Each result carries that op\'s outcome, same as the standalone call: `id`/`created` for an upsert, `moved` for move_task (false = the card was already in that position).',
    {
      ...orgArg,
      ...cycleSlugArg,
      operations: z.array(
        z.object({
          tool: z.string().describe('Tool name: upsert_pitch, upsert_scope, upsert_task, move_task, upsert_parking_item, upsert_squad, delete_pitch, delete_scope, delete_task, delete_parking_item, delete_squad, undo_update'),
          params: z.record(z.unknown()).describe('Tool parameters'),
        })
      ),
    },
    {
      title: 'Batch write operations',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, operations }: { org?: string; cycle_slug: string; operations: BatchOp[] },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleBatch(resolved.org.id, cycle_slug, operations)
    }
  )

  defineTool(
    server,
    'map_list_areas',
    "List the areas of the organization's Product Map. An area is a named region of the product, for example Integrations or Billing. An area with a \"parentAreaId\" is a sub-area. \"x\" and \"y\" are a position on a coarse grid, not pixels — the app draws the area's shape from them.",
    orgArg,
    { title: 'List areas', readOnlyHint: true, openWorldHint: false },
    async ({ org }: { org?: string }, extra: ToolExtra) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleListAreas(resolved.org.id)
    }
  )

  defineTool(
    server,
    'map_upsert_area',
    'Create a named area on the Product Map, or update one by id. A new area needs only a "name" — omit the position and it lands on the next free grid slot, because the app draws the shape. Updates are PARTIAL: any field you omit is left unchanged, and pass "" to clear an optional field. To file a frame into an area, pass the area id to map_upsert_frame.',
    {
      ...orgArg,
      // All optional with NO .default() — omitting a field must leave it
      // unchanged, never coerce it away (ADR 0011).
      id: z.string().optional().describe('Area id. Omit to create a new area.'),
      name: z
        .string()
        .optional()
        .describe('The name of the region, e.g. "Integrations". Required when creating.'),
      parent_area_id: z
        .string()
        .optional()
        .describe('Make this a sub-area of that area. Pass "" to lift it back to the top level.'),
      // Non-negative integers only: the app multiplies these into a pixel
      // offset, and a negative one puts the area off-canvas for good.
      x: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Grid column, 0 or more. Omit on create for the next free slot.'),
      y: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Grid row, 0 or more. Omit on create for the next free slot.'),
      owner: z
        .string()
        .optional()
        .describe(
          'Clerk user id of the area owner — the suggested frame owner for this area, and nothing more. Pass "" to clear.'
        ),
    },
    {
      title: 'Create or update an area',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      {
        org,
        ...params
      }: {
        org?: string
        id?: string
        name?: string
        parent_area_id?: string
        x?: number
        y?: number
        owner?: string
      },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleUpsertArea(resolved.org.id, params)
    }
  )

  defineTool(
    server,
    'map_list_frames',
    'List the frames on the organization\'s Product Map. A frame is one problem in the product: a bug, an idea, a request, a security problem or an irritant. The Product Map is org-scoped and names no cycle — the map holds problems, a cycle holds the bets.',
    orgArg,
    { title: 'List frames', readOnlyHint: true, openWorldHint: false },
    async ({ org }: { org?: string }, extra: ToolExtra) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleListFrames(resolved.org.id)
    }
  )

  defineTool(
    server,
    'map_upsert_frame',
    'Capture a new frame, or update an existing one by id. A new frame needs only a "problem" and a "type" — everything else is optional, so noticing a problem costs nothing. Updates are PARTIAL: any field you omit is left unchanged, and pass "" to clear an optional field. Reports, pointers and the wake clock are never touched here. A frame with no appetite stays rough until somebody sharpens it.',
    {
      ...orgArg,
      // All optional with NO .default() — omitting a field must leave it
      // unchanged, never coerce it away (ADR 0011).
      id: z.string().optional().describe('Frame id. Omit to capture a new frame.'),
      problem: z
        .string()
        .optional()
        .describe('One line saying what hurts. Required when capturing a new frame.'),
      type: z
        .enum(FRAME_TYPES)
        .optional()
        .describe(
          'Where the problem came from and how it gets worked. Type selects the playbook. Required when capturing a new frame.'
        ),
      kind: z
        .enum(FRAME_KINDS)
        .optional()
        .describe(
          'How much it hurts, and the pin color on the map. Defaults to "pain_point" on capture.'
        ),
      appetite: z
        .string()
        .optional()
        .describe('The time the business will spend, e.g. "6 weeks". A frame with an appetite and a problem is sharp.'),
      business_case: z
        .string()
        .optional()
        .describe('Free text: who is affected, what it is worth, why now.'),
      area_id: z
        .string()
        .optional()
        .describe('Area to file the frame in. Omit to leave it Unmapped, which is always valid. Pass "" to unfile it.'),
      owner: z.string().optional().describe('Clerk user id of the frame owner. Pass "" to clear.'),
      origin_frame_id: z
        .string()
        .optional()
        .describe('The frame whose monitoring surfaced this one. Pass "" to clear.'),
    },
    {
      title: 'Capture or update a frame',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      {
        org,
        ...params
      }: {
        org?: string
        id?: string
        problem?: string
        type?: string
        kind?: string
        appetite?: string
        business_case?: string
        area_id?: string
        owner?: string
        origin_frame_id?: string
      },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      return handleUpsertFrame(resolved.org.id, params)
    }
  )
}
