import { z } from 'zod'
import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { parseSlugPath } from './slug-path'
import { resolveOrg, type OrgMembership } from './auth'
import { derivePitchCards } from '@/lib/mission-control-helpers'

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

export function registerCyclesTools(server: any): void {
  server.tool(
    'list_cycles',
    'List cycles. With no "org" argument: lists cycles for the user\'s only org, or grouped by org if they belong to several.',
    orgArg,
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

  server.tool(
    'get_cycle',
    'Get cycle details with pitch summaries',
    { ...orgArg, ...slugPathArg },
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

  server.tool(
    'get_pitch',
    'Get full pitch detail with scopes, tasks, and parking items',
    { ...orgArg, ...slugPathArg },
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

  server.tool(
    'get_pitch_updates',
    'Get update history for a pitch, newest first',
    { ...orgArg, ...slugPathArg },
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
}
