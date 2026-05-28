import { z } from 'zod'
import { listCycleRooms, getCycleStorage, resolvePitch } from './liveblocks-reader'
import { parseSlugPath } from './slug-path'
import { derivePitchCards } from '@/lib/mission-control-helpers'

const slugPathSchema = { slug_path: z.string().describe('Slug path, e.g. "2026-q2-build" or "2026-q2-build/mission-control"') }

type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: true
}

function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

export async function handleListCycles(orgId: string): Promise<ToolResult> {
  const rooms = await listCycleRooms(orgId)
  return jsonResult(rooms)
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

export function registerCyclesTools(server: any, orgId: string): void {
  server.tool('list_cycles', 'List all cycles for the organization', {}, async () => {
    return handleListCycles(orgId)
  })

  server.tool(
    'get_cycle',
    'Get cycle details with pitch summaries',
    slugPathSchema,
    async ({ slug_path }: { slug_path: string }) => {
      const parsed = parseSlugPath(slug_path)
      return handleGetCycle(orgId, parsed.cycleSlug)
    }
  )

  server.tool(
    'get_pitch',
    'Get full pitch detail with scopes, tasks, and parking items',
    slugPathSchema,
    async ({ slug_path }: { slug_path: string }) => {
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handleGetPitch(orgId, parsed.cycleSlug, parsed.pitchSlug)
    }
  )

  server.tool(
    'get_pitch_updates',
    'Get update history for a pitch, newest first',
    slugPathSchema,
    async ({ slug_path }: { slug_path: string }) => {
      const parsed = parseSlugPath(slug_path)
      if (parsed.kind !== 'pitch') {
        return errorResult('slug_path must include both cycle and pitch slug: "cycle-slug/pitch-slug"')
      }
      return handleGetPitchUpdates(orgId, parsed.cycleSlug, parsed.pitchSlug)
    }
  )
}
