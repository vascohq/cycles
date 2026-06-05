import { z } from 'zod'
import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { parseSlugPath, isValidSlugSegment } from './slug-path'
import { resolveOrg, type OrgMembership } from './auth'
import { slugify } from '@/lib/slugify'
import { derivePitchCards } from '@/lib/mission-control-helpers'
import { deriveTotalTaskProgress } from '@/lib/scope-map-helpers'
import { buildUpdate } from '@/lib/update-engine'
import { computeTimebox } from '@/lib/timebox-engine'
import { normalizeEmoji, validateNotionUrl } from '@/lib/pitch-identity-engine'
import { formatSlackMessage, type SlackMessageParams } from '@/lib/slack-message'
import { deliverSlackUpdate, isSlackConfigured } from '@/lib/slack-delivery'
import { diffHillTrail, noChangeStreaks, summarizeMovement } from '@/lib/hill-trail-engine'
import { resolveOrigin } from './origin'
import type { Zone, Needle } from '@/cycle-liveblocks.config'
import {
  createCycle,
  updateCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
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
} from './liveblocks-writer'

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
    slack_channel: string
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
    slack_channel?: string
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

    const scopes = storage.scopes
      .filter((s) => s.pitchId === pitch.id)
      .map((scope) => ({
        ...scope,
        tasks: storage.tasks.filter((t) => t.scopeId === scope.id),
      }))

    const parkingItems = storage.parkingItems.filter(
      (p) => p.pitchId === pitch.id
    )

    return jsonResult({ pitch, scopes, parkingItems })
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

  return jsonResult({
    slack_text,
    would_deliver: isSlackConfigured(),
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
  const enabled = isSlackConfigured()
  if (enabled) built.slack_attempted = true

  try {
    await pushUpdate(roomId, built)
  } catch (err) {
    return errorResult((err as Error).message)
  }

  // Slack failure is non-fatal — the update is already persisted.
  let slack: 'delivered' | 'failed' | 'disabled' = 'disabled'
  if (enabled) {
    const result = await deliverSlackUpdate(ctx.slackParams(built.posted_at))
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

type BatchOp = { tool: string; params: Record<string, unknown> }
type BatchResult = { ok: true; tool: string; id?: string; created?: boolean } | { ok: false; tool: string; error: string }

const WRITE_TOOLS: Record<
  string,
  (roomId: string, params: any) => Promise<{ created: boolean; id: string } | void>
> = {
  upsert_pitch: upsertPitch,
  upsert_scope: upsertScope,
  upsert_task: upsertTask,
  upsert_parking_item: upsertParkingItem,
  upsert_squad: upsertSquad,
  delete_squad: (roomId, p) => deleteSquad(roomId, p.id).then(() => undefined),
  delete_pitch: (roomId, p) => deletePitch(roomId, p.id).then(() => undefined),
  delete_scope: (roomId, p) => deleteScope(roomId, p.id).then(() => undefined),
  delete_task: (roomId, p) => deleteTask(roomId, p.id).then(() => undefined),
  delete_parking_item: (roomId, p) => deleteParkingItem(roomId, p.id).then(() => undefined),
  undo_update: (roomId, p) => deleteUpdate(roomId, p.id).then(() => undefined),
}

export async function handleBatch(
  orgId: string,
  cycleSlug: string,
  operations: BatchOp[]
): Promise<ToolResult> {
  const roomId = `${orgId}:cycle:${cycleSlug}`
  const results: BatchResult[] = []

  for (const op of operations) {
    const handler = WRITE_TOOLS[op.tool]
    if (!handler) {
      results.push({ ok: false, tool: op.tool, error: `Unknown tool: "${op.tool}"` })
      continue
    }
    try {
      const result = await handler(roomId, op.params)
      if (result) {
        results.push({ ok: true, tool: op.tool, id: result.id, created: result.created })
      } else {
        results.push({ ok: true, tool: op.tool })
      }
    } catch (err) {
      results.push({ ok: false, tool: op.tool, error: (err as Error).message })
    }
  }

  return jsonResult({ results })
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
      slack_channel: z.string().default('#product-general'),
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
        slack_channel: string
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
    'Update an existing cycle\'s top-level fields, addressed by slug. The slug itself is immutable. Updates are PARTIAL: any field you omit (name, type, start_date, end_date, slack_channel) is left unchanged — only fields you pass are overwritten. Pass "" to clear a date. Fails if no cycle with that slug exists.',
    {
      ...orgArg,
      ...slugPathArg,
      // All optional with NO .default() — omitting a field must leave it
      // unchanged, never coerce it to '' (the timebox-nullification incident).
      name: z.string().optional().describe('Human-readable cycle name. Omit to leave unchanged.'),
      type: z.enum(['build', 'cooldown']).optional().describe('Cycle type. Omit to leave unchanged.'),
      start_date: z.string().optional().describe('ISO date (YYYY-MM-DD). Pass "" to clear; omit to leave unchanged.'),
      end_date: z.string().optional().describe('ISO date (YYYY-MM-DD). Pass "" to clear; omit to leave unchanged.'),
      slack_channel: z.string().optional().describe('Target Slack channel. Omit to leave unchanged.'),
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
        slack_channel?: string
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
    'get_pitch',
    'Get full pitch detail with scopes, tasks, and parking items',
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
      stage: z.enum(['framing', 'shaping', 'building', 'done']),
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
    },
    {
      title: 'Create or update pitch',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; title: string; stage: string; frame_problem?: string; frame_outcome?: string; timebox_start?: string; timebox_end?: string; emoji?: string; notion_url?: string; squad?: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      // undefined = field omitted = leave unchanged on update. Only normalize when
      // a value was actually supplied, so we never coerce an omitted field to ''.
      const notion =
        params.notion_url === undefined ? undefined : validateNotionUrl(params.notion_url)
      try {
        const result = await upsertPitch(roomId, {
          ...params,
          emoji: params.emoji === undefined ? undefined : normalizeEmoji(params.emoji),
          notion_url:
            notion === undefined ? undefined : notion.isValidUrl ? notion.value : '',
        })
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'upsert_scope',
    'Create or update a scope under a pitch. Omit id to create. Updates are PARTIAL: any field you omit (litmus_text, hill_progress, core) is left unchanged — only fields you pass are overwritten.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      pitchId: z.string().describe('Parent pitch id'),
      title: z.string(),
      tier: z.enum(['must', 'should', 'could']),
      // Optional (not .default) so an omitted field is left unchanged on update
      // rather than wiped / reset to 0. Defaults to '' / 0 on create.
      litmus_text: z.string().optional(),
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
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; pitchId: string; title: string; tier: string; litmus_text?: string; hill_progress?: number; core?: boolean },
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
    'Create or update a task under a scope. Omit id to create. Updates are PARTIAL: omit done to leave it unchanged — passing only a new title will NOT un-complete the task.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      scopeId: z.string().describe('Parent scope id'),
      title: z.string(),
      // Optional (not .default) so a title-only update leaves done unchanged
      // rather than resetting it to false. Defaults to false on create.
      done: z.boolean().optional(),
    },
    {
      title: 'Create or update task',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; scopeId: string; title: string; done?: boolean },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        const result = await upsertTask(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
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
    'Execute multiple write operations sequentially. Each operation specifies a tool and params. Returns results for all operations — successful ops persist even if others fail.',
    {
      ...orgArg,
      ...cycleSlugArg,
      operations: z.array(
        z.object({
          tool: z.string().describe('Tool name: upsert_pitch, upsert_scope, upsert_task, upsert_parking_item, upsert_squad, delete_pitch, delete_scope, delete_task, delete_parking_item, delete_squad, undo_update'),
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
}
