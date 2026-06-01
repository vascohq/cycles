import { z } from 'zod'
import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { parseSlugPath, isValidSlugSegment } from './slug-path'
import { resolveOrg, type OrgMembership } from './auth'
import { slugify } from '@/lib/slugify'
import { derivePitchCards } from '@/lib/mission-control-helpers'
import {
  createCycle,
  upsertPitch,
  upsertScope,
  upsertTask,
  upsertParkingItem,
  deletePitch,
  deleteScope,
  deleteTask,
  deleteParkingItem,
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
    return jsonResult({ cycle: storage.cycle, pitches: pitchCards })
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

export async function handleGetPitchUpdates(
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
  delete_pitch: (roomId, p) => deletePitch(roomId, p.id).then(() => undefined),
  delete_scope: (roomId, p) => deleteScope(roomId, p.id).then(() => undefined),
  delete_task: (roomId, p) => deleteTask(roomId, p.id).then(() => undefined),
  delete_parking_item: (roomId, p) => deleteParkingItem(roomId, p.id).then(() => undefined),
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
    'get_pitch_updates',
    'Get update history for a pitch, newest first',
    { ...orgArg, ...slugPathArg },
    { title: 'Get pitch updates', readOnlyHint: true, openWorldHint: false },
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
      return handleGetPitchUpdates(resolved.org.id, parsed.cycleSlug, parsed.pitchSlug)
    }
  )

  // ── Write tools ──

  const cycleSlugArg = {
    cycle_slug: z.string().describe('Cycle slug, e.g. "2026-q2-build"'),
  }

  defineTool(
    server,
    'upsert_pitch',
    'Create or update a pitch. IMPORTANT: before creating, call get_cycle to check for an existing pitch with the same name — if one exists, pass its id to update it instead of creating a duplicate. Omit id to create (returns generated id). Provide id to update.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional().describe('Pitch id. Omit to create.'),
      title: z.string(),
      stage: z.enum(['framing', 'shaping', 'building', 'done']),
      frame_problem: z.string().default(''),
      frame_outcome: z.string().default(''),
      timebox_start: z.string().default(''),
      timebox_end: z.string().default(''),
    },
    {
      title: 'Create or update pitch',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; title: string; stage: string; frame_problem: string; frame_outcome: string; timebox_start: string; timebox_end: string },
      extra: ToolExtra
    ) => {
      const memberships = getMemberships(extra)
      const resolved = resolveOrg(memberships, org)
      if (!resolved.ok) return errorResult(resolved.error)
      const roomId = `${resolved.org.id}:cycle:${cycle_slug}`
      try {
        const result = await upsertPitch(roomId, params)
        return jsonResult(result)
      } catch (err) {
        return errorResult((err as Error).message)
      }
    }
  )

  defineTool(
    server,
    'upsert_scope',
    'Create or update a scope under a pitch. Omit id to create.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      pitchId: z.string().describe('Parent pitch id'),
      title: z.string(),
      tier: z.enum(['must', 'should', 'could']),
      litmus_text: z.string().default(''),
      hill_progress: z.number().min(0).max(1).default(0),
    },
    {
      title: 'Create or update scope',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; pitchId: string; title: string; tier: string; litmus_text: string; hill_progress: number },
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
    'Create or update a task under a scope. Omit id to create.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      scopeId: z.string().describe('Parent scope id'),
      title: z.string(),
      done: z.boolean().default(false),
    },
    {
      title: 'Create or update task',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; scopeId: string; title: string; done: boolean },
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
    'Create or update a parking lot item under a pitch. Omit id to create.',
    {
      ...orgArg,
      ...cycleSlugArg,
      id: z.string().optional(),
      pitchId: z.string().describe('Parent pitch id'),
      text: z.string(),
      resolved: z.boolean().default(false),
    },
    {
      title: 'Create or update parking item',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (
      { org, cycle_slug, ...params }: { org?: string; cycle_slug: string; id?: string; pitchId: string; text: string; resolved: boolean },
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
    'batch',
    'Execute multiple write operations sequentially. Each operation specifies a tool and params. Returns results for all operations — successful ops persist even if others fail.',
    {
      ...orgArg,
      ...cycleSlugArg,
      operations: z.array(
        z.object({
          tool: z.string().describe('Tool name: upsert_pitch, upsert_scope, upsert_task, upsert_parking_item, delete_pitch, delete_scope, delete_task, delete_parking_item'),
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
