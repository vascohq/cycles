// Pure engine for the Product Map. It takes the requests and the team's "today"
// (ISO date string, resolved in the team timezone — see team-time.ts) and
// returns the rendered map model. No React, no Liveblocks, no clock of its own,
// the same shape as the cycle list engine.

import { STAGES } from '@/lib/stage-engine'
import type {
  Area,
  ProductRequest,
  RequestBrief,
  RequestKind,
  RequestOutcome,
  RequestPointer,
  RequestReport,
  RequestType,
  PointerKind,
} from '@/product-map-liveblocks.config'

import {
  centroid,
  generateRing,
  pinPosition,
  ringBounds,
  smoothPath,
  unionBounds,
  type Bounds,
  type Point,
  type Ring,
} from './product-map-geometry'

// Kind is how much a problem hurts. It is the only axis with a color on the Product Map.
export const REQUEST_KINDS = ['brand_burn', 'pain_point', 'unlock_win'] as const

// Type is where a problem came from and how it gets worked. Type selects the
// playbook (ADR 0025), and it gets NO visual channel on the Product Map.
export const REQUEST_TYPES = ['bug', 'idea', 'ask', 'security', 'irritant'] as const

// A pin's color is its Kind, and nothing else. Hues are taken from the scope
// palette so the two surfaces stay in one visual family: red burns, amber
// hurts, green is a win waiting to be unlocked.
export const KIND_COLORS: Record<RequestKind, string> = {
  brand_burn: '#e5484d',
  pain_point: '#ffb224',
  unlock_win: '#30a46c',
}

export const DEFAULT_KIND: RequestKind = 'pain_point'

export function isRequestKind(value: unknown): value is RequestKind {
  return (REQUEST_KINDS as readonly unknown[]).includes(value)
}

export function isRequestType(value: unknown): value is RequestType {
  return (REQUEST_TYPES as readonly unknown[]).includes(value)
}

/**
 * A request's position in its life. Derived from what the request points at and
 * never stored, so it can never drift from the truth (ADR 0025):
 *
 * `rough` (no appetite) → `candidate` (sharp, no pitch yet) → `pitched` (a
 * pitch waits in an upcoming cycle) → `in_flight` (a pitch that is not done) → `released` (its Shape reached done this cycle) →
 * `monitoring` (released, and nobody has resolved it) → `resolved` (a person
 * decided the problem is gone).
 */
export type RequestState =
  | 'rough'
  | 'candidate'
  | 'pitched'
  | 'in_flight'
  | 'released'
  | 'monitoring'
  | 'resolved'

/** Every Request state, in the order a request lives through them. */
export const REQUEST_STATES: readonly RequestState[] = [
  'rough',
  'candidate',
  'pitched',
  'in_flight',
  'released',
  'monitoring',
  'resolved',
]

/** A Shape's lifecycle phase. Mirrors the cycle model's Stage (ADR 0023). */
export type ShapeStage = 'framing' | 'shaping' | 'building' | 'done'

/**
 * A Shape that points home to a request. Passed in, because a request never stores
 * its shape list — the list is read from the cycle rooms (ADR 0022). The engine
 * takes summaries so it stays free of Liveblocks.
 */
export type LinkedShape = {
  requestId: string
  shapeId: string
  title: string
  stage: ShapeStage
  cycleSlug: string
  cycleTitle: string
  /** True when this shape sits in the cycle that is current today. */
  currentCycle: boolean
  /** True when this shape sits in a cycle that has not started yet. */
  upcomingCycle: boolean
  /** The squad on it this cycle. Absent when unassigned, or the squad is gone. */
  squad?: { name: string; color: string }
  /** The pitch's Notion doc. Absent when nobody linked one. */
  notionUrl?: string
  /** What changes for the customer, in their words. Absent when unwritten. */
  releaseSummary?: string
}

/** One link in a request's origin chain: the request whose monitoring surfaced it. */
export type OriginLink = { requestId: string; problem: string }

/**
 * The chain of origin requests behind this one, nearest first.
 *
 * A quality or adoption problem found while monitoring a release becomes a NEW
 * request with a pointer back, never a reopening of the old one (ADR 0025). The
 * chain is what makes "which releases create follow-on pain" visible, and
 * nobody maintains it: the pointer is set once, at capture.
 */
export function originChain(request: ProductRequest, requests: ProductRequest[]): OriginLink[] {
  const byId = new Map(requests.map((f) => [f.id, f]))
  const chain: OriginLink[] = []
  // A chain that loops back on itself would spin forever, and bad data is not a
  // reason to hang the Product Map.
  const seen = new Set<string>([request.id])
  let current = request.originRequestId
  while (current && !seen.has(current)) {
    seen.add(current)
    const origin = byId.get(current)
    if (!origin) break
    chain.push({ requestId: origin.id, problem: origin.problem })
    current = origin.originRequestId
  }
  return chain
}

/** A request related to this one, shown by its current problem line. */
export type RelatedLink = { requestId: string; problem: string }

/**
 * The requests related to this one. The relation goes both ways, so a request
 * named on either side counts, and a request that no longer exists drops out.
 */
export function relatedRequests(request: ProductRequest, requests: ProductRequest[]): RelatedLink[] {
  const ids = new Set(request.related_request_ids ?? [])
  for (const f of requests) if (f.related_request_ids?.includes(request.id)) ids.add(f.id)
  ids.delete(request.id)
  return requests.filter((f) => ids.has(f.id)).map((f) => ({ requestId: f.id, problem: f.problem }))
}

/**
 * The related lists that make `requestId` related to exactly `ids`, on both
 * sides. Only the requests whose list changes come back, keyed by request id; an
 * empty list means the field goes away. Refusing an unknown id or the request's
 * own id is the caller's job.
 */
export function relateRequests(
  requests: Pick<ProductRequest, 'id' | 'related_request_ids'>[],
  requestId: string,
  ids: string[]
): Map<string, string[]> {
  const want = new Set(ids)
  const changes = new Map<string, string[]>()
  for (const f of requests) {
    const current = f.related_request_ids ?? []
    const next =
      f.id === requestId
        ? [...want]
        : want.has(f.id)
          ? current.includes(requestId)
            ? current
            : [...current, requestId]
          : current.filter((id) => id !== requestId)
    if (next.length !== current.length || next.some((id, i) => id !== current[i])) {
      changes.set(f.id, next)
    }
  }
  return changes
}

/** A stored request the relation is written to: a LiveObject, in the app or on the server. */
type RelatableRequest = {
  get(key: 'id' | 'related_request_ids'): unknown
  set(key: 'related_request_ids', value: string[]): void
  delete(key: 'related_request_ids'): void
}

/**
 * Write the relation of `requestId` to exactly `ids` onto the stored requests, on
 * both sides. An empty list removes the field. The app, the MCP writer and a
 * request delete all write through here, so the two sides never drift apart.
 */
export function storeRelated(
  requests: Iterable<RelatableRequest>,
  requestId: string,
  ids: string[]
): void {
  const list = [...requests]
  const changes = relateRequests(
    list.map((f) => ({
      id: f.get('id') as string,
      related_request_ids: f.get('related_request_ids') as string[] | undefined,
    })),
    requestId,
    ids
  )
  for (const f of list) {
    const next = changes.get(f.get('id') as string)
    if (!next) continue
    if (next.length) f.set('related_request_ids', next)
    else f.delete('related_request_ids')
  }
}

/**
 * Engagement, the fourth and last pin channel:
 *
 * - `dashed` — a linked shape is still being shaped
 * - `solid` — a linked shape is in the cycle running now
 * - `none` — nobody is working on this
 */
export type PinOutline = 'none' | 'dashed' | 'solid'

export function pinOutline(shapes: LinkedShape[]): PinOutline {
  // A shape in the cycle happening now is the loudest signal, so it wins —
  // including one that already shipped. The request reads `released` at that
  // point, and a release this cycle is current investment, not "no work".
  if (shapes.some((s) => s.currentCycle)) return 'solid'
  if (shapes.some((s) => s.stage === 'framing' || s.stage === 'shaping')) return 'dashed'
  return 'none'
}

/**
 * The shapes that attacked a request, read from the cycle rooms. A request never
 * stores its shape list: a shape points at its request, not the reverse (ADR
 * 0022). Shapes with no request are dropped — they attack nothing on the Product Map.
 */
export function linkedShapesFrom(
  rooms: {
    cycle: CycleWindow
    shapes: {
      id: string
      title: string
      stage: string
      request_ids?: string[]
      squadId?: string
      notion_url?: string
      release_summary?: string
    }[]
    squads?: SquadSummary[]
  }[],
  today: string
): LinkedShape[] {
  return rooms.flatMap(({ cycle, shapes, squads = [] }) => {
    const currentCycle =
      !!cycle.start_date &&
      !!cycle.end_date &&
      today >= cycle.start_date &&
      today <= cycle.end_date
    const upcomingCycle = isUpcomingCycle(cycle, today)
    // A pitch carries many requests, so it counts once for each of them.
    return shapes.flatMap((shape) =>
      (shape.request_ids ?? []).map((requestId) => ({
        requestId,
        shapeId: shape.id,
        title: shape.title,
        // An unreadable stage is not a reason to lose the shape.
        stage: isShapeStage(shape.stage) ? shape.stage : 'shaping',
        cycleSlug: cycle.slug,
        cycleTitle: cycle.title || cycle.slug,
        currentCycle,
        upcomingCycle,
        ...squadOf(squads, shape.squadId),
        ...(shape.notion_url ? { notionUrl: shape.notion_url } : {}),
        ...(shape.release_summary ? { releaseSummary: shape.release_summary } : {}),
      }))
    )
  })
}

/** A cycle that has not started yet: where a new pitch waits for the betting table. */
export function isUpcomingCycle(cycle: Pick<CycleWindow, 'start_date'>, today: string): boolean {
  return !!cycle.start_date && today < cycle.start_date
}

/** What the Product Map needs of a squad from a cycle room. */
type SquadSummary = { id: string; name: string; color: string }

function squadOf(squads: SquadSummary[], id?: string) {
  const squad = id ? squads.find((s) => s.id === id) : undefined
  return squad ? { squad: { name: squad.name, color: squad.color } } : {}
}

function isShapeStage(value: unknown): value is ShapeStage {
  return (STAGES as unknown[]).includes(value)
}

/**
 * A request is **sharp** when it has a problem, an appetite and at least one
 * outcome. Derived, never a stored flag, the same way the cycle phase is
 * date-derived (ADR 0015). Only a sharp request can be bet on, so nobody bets on
 * a request that never says what would change.
 */
export function isSharp(request: Pick<ProductRequest, 'problem' | 'appetite' | 'outcomes'>): boolean {
  return (
    text(request.problem) !== '' && text(request.appetite) !== '' && statedOutcomes(request).length > 0
  )
}

/**
 * A request's outcomes, ignoring the blank ones. Requests captured before outcomes
 * existed carry no such field at all, so the list is read defensively — the
 * same reason `text` exists.
 */
export function statedOutcomes(request: Pick<ProductRequest, 'outcomes'>): RequestOutcome[] {
  return (request.outcomes ?? []).filter((outcome) => text(outcome?.text) !== '')
}

/** What a new pitch copies from its requests (ADR 0032). After that, the pitch owns it. */
export type PitchFrameSeed = {
  frame_problem: string
  frame_outcomes: RequestOutcome[]
  frame_appetite: string
  release_summary: string
}

const DAYS_PER_UNIT: Record<string, number> = { day: 1, week: 5, month: 20 }

/** "2 weeks" → 10 business days. Null when the free text names no length. */
function appetiteDays(appetite: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(day|week|month)/i.exec(appetite)
  return match ? Number(match[1]) * DAYS_PER_UNIT[match[2].toLowerCase()] : null
}

/**
 * Seed the frame of a new pitch from the requests it carries: every outcome,
 * the largest appetite, and the first release draft. The problem joins the
 * request summaries, one per line, for the framer to rework.
 */
export function seedPitchFrame(
  requests: Pick<ProductRequest, 'problem' | 'appetite' | 'outcomes' | 'announcement'>[]
): PitchFrameSeed {
  const appetites = requests.map((r) => text(r.appetite)).filter(Boolean)
  // ponytail: reads "N days|weeks|months" only; anything else keeps the first appetite.
  const largest = appetites.reduce<string | undefined>((best, next) => {
    const a = best === undefined ? null : appetiteDays(best)
    const b = appetiteDays(next)
    return best === undefined || (b !== null && (a === null || b > a)) ? next : best
  }, undefined)
  return {
    frame_problem: requests.map((r) => text(r.problem)).filter(Boolean).join('\n'),
    frame_outcomes: requests.flatMap(statedOutcomes),
    frame_appetite: largest ?? '',
    release_summary: requests.map((r) => text(r.announcement)).find(Boolean) ?? '',
  }
}

/**
 * The sentence the Product Map shows under a sharp request. The app builds it from the
 * problem and the appetite, so nobody types it. null for a rough request: there
 * is no commitment to state until an appetite exists.
 */
export function candidateStatement(
  request: Pick<ProductRequest, 'problem' | 'appetite' | 'outcomes'>
): string | null {
  if (!isSharp(request)) return null
  return `If we can shape this into something doable in ${text(request.appetite)}, that is meaningful to us.`
}

/**
 * A request's state, from its appetite, its linked shapes and the resolved flag.
 * Nothing here is stored.
 */
export function requestState(
  request: Pick<ProductRequest, 'problem' | 'appetite' | 'outcomes' | 'resolved'>,
  shapes: LinkedShape[] = []
): RequestState {
  // A person's decision outranks every derivation. Nothing resolves on a timer.
  if (request.resolved) return 'resolved'
  if (shapes.length > 0) {
    // One shape still moving means work is in flight, even beside an older
    // release: a request can be attacked again years later (ADR 0022).
    const moving = shapes.filter((s) => s.stage !== 'done')
    if (moving.some((s) => !s.upcomingCycle)) return 'in_flight'
    // Every live pitch waits for the betting table, even beside an old release.
    if (moving.length > 0) return 'pitched'
    // Every shape is done. `released` while the release is this cycle's news;
    // `monitoring` once it is not. Monitoring has no end condition, so only a
    // person moves a request on from here (ADR 0025).
    return shapes.some((s) => s.currentCycle) ? 'released' : 'monitoring'
  }
  return isSharp(request) ? 'candidate' : 'rough'
}

/** Stored strings outlive the code that wrote them, so read them defensively. */
function text(value: string | undefined): string {
  return (value ?? '').trim()
}

/**
 * A cycle's time boundary, as the Product Map needs it. Freshness is counted in CYCLES
 * and not in weeks, so the Product Map only changes state at a moment when somebody is
 * looking (ADR 0024).
 */
export type CycleWindow = {
  slug: string
  /** What the cycle is called, so the request detail names it rather than its slug. */
  title: string
  type: 'build' | 'cooldown'
  /** ISO dates (YYYY-MM-DD), or '' when the cycle is undated. */
  start_date: string
  end_date: string
}

/**
 * Both freshness thresholds are configuration and not constants, so the team
 * can tune them after two cycles of real use (ADR 0024).
 */
export type FreshnessConfig = {
  /** Cycles without a wake before a pin starts to fade. */
  dimAfterCycles: number
  /** Cycles without a wake before the sweep puts the request to sleep. */
  dormantAfterCycles: number
  /** Most dormant candidates the end-of-cycle review will show. */
  reviewQueueCap: number
}

export const DEFAULT_FRESHNESS: FreshnessConfig = {
  dimAfterCycles: 1,
  dormantAfterCycles: 2,
  reviewQueueCap: 10,
}

/** Six weeks — the Shape Up default, used when no cycle exists to measure. */
export const FALLBACK_CYCLE_DAYS = 42
/** A faded pin must still be findable, so opacity stops here. */
export const MIN_OPACITY = 0.35

/**
 * Completed cycles since the request was last woken. A cycle counts once it has
 * ended, which is why a request's dormancy can only change at a cycle boundary.
 */
export function cyclesSinceWoken(
  lastWoken: string,
  cycles: CycleWindow[],
  today: string
): number {
  if (!lastWoken) return 0
  // ISO calendar dates compare lexically, the same trick the cycle list engine
  // uses. An undated cycle has no boundary, so it cannot age anything.
  return buildCycles(cycles).filter(
    (c) => c.end_date && c.end_date >= lastWoken && c.end_date < today
  ).length
}

/**
 * Only build cycles age a request. A cooldown is its own room in this app, so
 * counting both would make "no wake for two cycles" fire after one build cycle
 * and its cooldown — half the window ADR 0024 asks for. The same reason keeps
 * cooldowns out of the average cycle length that drives dimming.
 */
function buildCycles(cycles: CycleWindow[]): CycleWindow[] {
  return cycles.filter((c) => c.type !== 'cooldown')
}

/**
 * True when the sweep would put this request to sleep. One rule, shared by the
 * rendered map and by `map_list_requests`, so the two can never disagree about
 * which requests are asleep.
 */
export function isDormant(
  lastWoken: string,
  cycles: CycleWindow[],
  today: string,
  config: FreshnessConfig = DEFAULT_FRESHNESS
): boolean {
  return cyclesSinceWoken(lastWoken, cycles, today) >= config.dormantAfterCycles
}

/**
 * How solid a pin draws. Freshness is the third pin channel: a pin fades as its
 * clock runs, so a stale map looks stale. Dimming is measured in DAYS, because
 * a pin fades through a cycle rather than jumping at its end — only dormancy
 * waits for the boundary.
 */
export function pinOpacity(
  daysSinceWoken: number | null,
  cycles: CycleWindow[],
  config: FreshnessConfig
): number {
  if (daysSinceWoken === null || daysSinceWoken <= 0) return 1
  const span = config.dormantAfterCycles * averageCycleDays(cycles)
  if (span <= 0) return 1
  const fresh = 1 - daysSinceWoken / span
  return Math.max(MIN_OPACITY, Math.min(1, Number(fresh.toFixed(3))))
}

/** The team's own cycle length, or the Shape Up default when they have none. */
function averageCycleDays(cycles: CycleWindow[]): number {
  const spans = buildCycles(cycles)
    .map((c) => daysBetween(c.start_date, c.end_date))
    .filter((d): d is number => d !== null && d > 0)
  if (spans.length === 0) return FALLBACK_CYCLE_DAYS
  return spans.reduce((sum, d) => sum + d, 0) / spans.length
}

/** True when today falls inside a cooldown cycle, where the sweep belongs. */
export function inCooldown(cycles: CycleWindow[], today: string): boolean {
  return cycles.some(
    (c) =>
      c.type === 'cooldown' &&
      c.start_date &&
      c.end_date &&
      today >= c.start_date &&
      today <= c.end_date
  )
}

/**
 * The kinds of artifact a request can point at. A request holds ONLY pointers — the
 * artifacts live in GitHub, in Notion or in a wayfinder map and stay there, so
 * the Product Map never becomes a second copy that drifts.
 *
 * There is deliberately no kind for a Shape. A shape points at its request, not
 * the reverse, so a request's shape list is read from the cycle rooms (ADR 0022).
 */
export const POINTER_KINDS = [
  'issue',
  'wayfinder',
  'research',
  'shaped_doc',
  'pull_request',
  'conversation',
] as const satisfies readonly PointerKind[]

export type { PointerKind }

export function isPointerKind(value: unknown): value is PointerKind {
  return (POINTER_KINDS as readonly unknown[]).includes(value)
}

/**
 * Prose for each pointer kind. Shared, because the writer needs it as the
 * fallback label for a pointer that arrived without one, and the view needs it
 * to name a gap.
 */
export const POINTER_KIND_LABELS: Record<PointerKind, string> = {
  issue: 'Issue',
  wayfinder: 'Wayfinder map',
  research: 'Research',
  shaped_doc: 'Shaped writeup',
  pull_request: 'Pull request',
  conversation: 'Conversation',
}

/**
 * Type selects the playbook, and a playbook names the pointer kinds its requests
 * expect (ADR 0025). This is routing, not decoration: a bug expects less than
 * an idea, because a small fix should not carry Shape Up ceremony.
 *
 * The expected set minus the request's own pointers is its **Gap list**. A gap
 * blocks NOTHING. It is a prompt, never a gate.
 */
export const PLAYBOOKS: Record<RequestType, { expects: readonly PointerKind[] }> = {
  // Reproduce it, fix it, point at the fix. No shaping ceremony.
  bug: { expects: ['issue', 'pull_request'] },
  // A feature runs Shape Up: read first, shape it, then build it.
  idea: { expects: ['research', 'shaped_doc', 'pull_request'] },
  // An ask starts in a conversation, and it still has to be shaped.
  ask: { expects: ['conversation', 'shaped_doc'] },
  // One pull request per service is how these actually get fixed. The gap list
  // cannot count services — there is no service model — so it asks for the
  // first pull request and the playbook prose carries the rest.
  security: { expects: ['issue', 'pull_request'] },
  // An irritant expects nothing. It is a note, not a project.
  irritant: { expects: [] },
}

/** The pointer kinds a request's playbook expects and the request does not have. */
export function gapList(request: Pick<ProductRequest, 'type' | 'pointers'>): PointerKind[] {
  const playbook = PLAYBOOKS[request.type]
  // A Type with no playbook would be a bug, not a reason to throw at read time.
  if (!playbook) return []
  const have = new Set((request.pointers ?? []).map((p) => p.kind))
  return playbook.expects.filter((kind) => !have.has(kind))
}

/**
 * Which reports count towards a pin's size. A request has ONE freshness clock;
 * the lens only filters what feeds the size. A request hot with customers and
 * cold internally is the most useful thing the Product Map can show.
 */
export const HEAT_LENSES = ['all', 'internal', 'customer'] as const
export type HeatLens = (typeof HEAT_LENSES)[number]

export const DEFAULT_LENS: HeatLens = 'all'

export function isHeatLens(value: unknown): value is HeatLens {
  return (HEAT_LENSES as readonly unknown[]).includes(value)
}

/**
 * Whether a `raised_by` names a member (a Clerk user id) rather than somebody
 * outside the app, written as free text. Clerk user ids start with `user_`.
 */
export function isMemberId(raisedBy: string): boolean {
  return raisedBy.startsWith('user_')
}

/**
 * Every report with an id. A report written before ids existed has none stored,
 * so it gets one derived from its capturer, date and text, and nothing needs
 * migrating. The first correction on a request stores the ids, so they never move
 * after that. Identical old reports take a numbered suffix, so each one can be
 * addressed on its own.
 */
/** A report whose id is known, stored or derived. */
export type IdentifiedReport = RequestReport & { id: string }

export function withReportIds(reports: RequestReport[]): IdentifiedReport[] {
  const used = new Set(reports.flatMap((r) => (r.id ? [r.id] : [])))
  return reports.map((r) => {
    if (r.id) return { ...r, id: r.id }
    const base = `r_${fnv1a(`${r.capturer}\n${r.date}\n${r.text}`)}`
    let id = base
    for (let n = 1; used.has(id); n++) id = `${base}_${n}`
    used.add(id)
    return { ...r, id }
  })
}

/** What a correction can change. The date and the capturer never change. */
export type ReportPatch = {
  text?: string
  link?: string
  customer?: string
  source?: RequestReport['source']
}

/**
 * The reports with one corrected in place (ADR 0030), or null when no report
 * has that id. Partial: an omitted field stays, and "" clears the link or the
 * customer. Every report comes back with its id stored, so a derived id never
 * moves after the first correction.
 */
export function correctReport(
  reports: RequestReport[],
  reportId: string,
  patch: ReportPatch,
  editor: string,
  today: string
): RequestReport[] | null {
  const all: RequestReport[] = withReportIds(reports)
  const idx = all.findIndex((r) => r.id === reportId)
  if (idx === -1) return null
  const before = all[idx]
  const report = { ...before }
  if (patch.text !== undefined) report.text = patch.text.trim()
  if (patch.source !== undefined) report.source = patch.source
  for (const key of ['link', 'customer'] as const) {
    const value = patch[key]?.trim()
    if (value === undefined) continue
    if (value) report[key] = value
    else delete report[key]
  }
  // An internal report names no customer, the same rule capture follows.
  if (report.source === 'internal') delete report.customer
  // A save that changes nothing is not an edit, so it leaves no "edited" mark.
  const fields = ['text', 'source', 'link', 'customer'] as const
  if (fields.every((key) => report[key] === before[key])) return all
  all[idx] = { ...report, edited_on: today, edited_by: editor }
  return all
}

/** The reports without the one recorded in error, or null when no report has that id. */
export function removeReport(reports: RequestReport[], reportId: string): RequestReport[] | null {
  const all = withReportIds(reports)
  const kept = all.filter((r) => r.id !== reportId)
  return kept.length === all.length ? null : kept
}

// ponytail: 32-bit FNV-1a. Ids only need to differ within one request's reports.
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** How many of a request's reports the lens lets through. */
export function reportCount(request: Pick<ProductRequest, 'reports'>, lens: HeatLens): number {
  const reports = request.reports ?? []
  if (lens === 'all') return reports.length
  return reports.filter((r) => r.source === lens).length
}

// Size is the report count, so widespread pain looks bigger. Growth is by
// square root: ten reports must read as louder than one, not as ten dots wide,
// and the cap stops one shouty request swallowing its area.
export const PIN_MIN_SIZE = 10
export const PIN_MAX_SIZE = 28
const PIN_SIZE_PER_ROOT = 6

/** A pin's diameter in pixels, from the report count under the active lens. */
export function pinSize(count: number): number {
  if (count <= 0) return PIN_MIN_SIZE
  return Math.min(PIN_MAX_SIZE, PIN_MIN_SIZE + Math.round(Math.sqrt(count) * PIN_SIZE_PER_ROOT))
}

/**
 * Everything the Product Map and the request detail draw for one request. The **Pin** proper
 * is only the marker; the rest of these fields are the request's own text, carried
 * here so the view derives nothing for itself.
 */
export type RenderedPin = {
  requestId: string
  areaId: string
  kind: RequestKind
  type: RequestType
  problem: string
  appetite: string
  businessCase: string
  /** The draft release announcement, or '' when nobody wrote one. */
  announcement: string
  /** The last brief somebody left on the request, or null before the first. */
  brief: RequestBrief | null
  /** What must be true afterwards. Blank lines never reach here. */
  outcomes: RequestOutcome[]
  /** Clerk user id of the request owner, or null when nobody holds it. */
  owner: string | null
  /** Who raised the problem: a Clerk user id or a free-text name. Null when unknown. */
  raisedBy: string | null
  /** Color is the Kind. The other three pin channels arrive with their tickets. */
  color: string
  /** Every report on the request, unfiltered — the detail shows the evidence. */
  reports: IdentifiedReport[]
  /** The outbound links this request packages. No artifact is ever stored. */
  pointers: RequestPointer[]
  /** What the playbook expects and the request lacks. A prompt, never a gate. */
  gaps: PointerKind[]
  /** Reports that pass the active heat lens. Size reads this, nothing else. */
  reportCount: number
  /**
   * Whether this request survives the active heat lens. Always true under `all`,
   * INCLUDING a request nobody has reported yet — a fresh capture must not vanish.
   * Under `internal` or `customer` it takes at least one report from that side,
   * so switching the lens visibly shrinks the areas only the other side is
   * complaining about. That contrast is the point of the lens.
   */
  passesLens: boolean
  /** Diameter in pixels. Size is the second pin channel. */
  size: number
  /** A problem, an appetite AND an outcome. A rough pin must never look like agreed work. */
  sharp: boolean
  state: RequestState
  /** Engagement, the fourth pin channel: read from the linked shapes' stages. */
  outline: PinOutline
  /** Every shape that attacked this request, with its cycle. Never stored. */
  shapes: LinkedShape[]
  /**
   * Somebody has bet on this before. The Product Map shows a MARK and no number: past
   * investment must never read as priority (ADR 0024).
   */
  worked: boolean
  /** The requests whose monitoring surfaced this one, nearest first. */
  originChain: OriginLink[]
  /** The requests related to this one, read from both sides. */
  related: RelatedLink[]
  /** Built from the problem and the appetite. null for a rough request. */
  candidateStatement: string | null
  /**
   * Whole days between the request's last wake and today. null when the request has
   * never been woken or carries an unreadable date.
   */
  daysSinceWoken: number | null
  /** Completed cycles since the last wake. Dormancy counts these, not days. */
  cyclesSinceWoken: number
  /** Freshness, the third pin channel. 1 is wide awake. */
  opacity: number
  /** Fading, but still on the Product Map. */
  dim: boolean
  /**
   * Nobody has woken it for the sleep threshold. A dormant request leaves the Product Map
   * view and keeps every field and every report (ADR 0024).
   */
  dormant: boolean
  /**
   * Where the pin sits, in world space. Derived from the request id alone, so a pin
   * lands on the same spot forever and capturing a request never moves the others.
   * null for an Unmapped request, which has no land to sit on and lives in the tray.
   */
  at: Point | null
}

// An area's fallback shape is GENERATED from its grid position, so an area
// created before outlines existed still reads as land. An area that carries an
// outline uses it, and nothing needs migrating.
const AREA_WIDTH = 320
const AREA_HEIGHT = 220
export const AREA_GAP = 24
/** Each level of nesting draws smaller, so a sub-area reads as inside its parent. */
const SUB_AREA_SCALE = 0.7

/**
 * How an area is drawn. The three levels are derived from the shape of the tree,
 * never stored: a leaf is an `area`, whatever holds leaves is an `island`, and
 * whatever holds islands is an `archipelago`. Anything deeper draws as a label,
 * because four levels of coastline is past the legibility ceiling.
 */
export type AreaLevel = 'area' | 'island' | 'archipelago'

/** A region of the product, drawn from its coastline. Never colored by its requests. */
export type RenderedArea = {
  areaId: string
  name: string
  parentAreaId: string | null
  /** Generated from the area's grid position. See AREA_WIDTH. */
  shape: { x: number; y: number; width: number; height: number }
  /** The area's coastline in world space: stored if drawn, generated if not. */
  ring: Ring
  /** `ring` as a smoothed closed SVG path. */
  path: string
  /** Where the name goes: inside the coastline, never rotated. */
  labelAt: Point
  /** The box round this area AND its children, which is what the zoom ladder measures. */
  bounds: Bounds
  level: AreaLevel
  /** The suggested Request owner for this area, and nothing more. */
  owner: string | null
  pins: RenderedPin[]
  /**
   * The requests this area's team resolved. They are off the Product Map and still on
   * record here, with the shapes that resolved them (ADR 0025).
   */
  resolved: RenderedPin[]
  children: RenderedArea[]
}

export type ProductMapModel = {
  /** Awake pins only. A dormant request is not on the Product Map (ADR 0024). */
  pins: RenderedPin[]
  areas: RenderedArea[]
  /** Requests that belong to no area. Unmapped is always a valid result. */
  unmapped: RenderedPin[]
  /** Resolved requests that belonged to no area, kept on record under Unmapped. */
  unmappedResolved: RenderedPin[]
  /**
   * Requests a person resolved. Off the Product Map, never deleted, and still readable so
   * the Product Map does not lie about what the team knows.
   */
  resolved: RenderedPin[]
  /**
   * The sweep's review queue: requests that just went to sleep, capped, and shown
   * only during cooldown. It exists so a wake the transcript missed is
   * recoverable. There is deliberately NO browsable list of dormant requests —
   * reaching one takes a filtered query, and that friction is the feature.
   */
  dormantReview: RenderedPin[]
}

export function renderProductMap(input: {
  /** Optional: a room root that predates the areas list still renders. */
  areas?: Area[]
  requests: ProductRequest[]
  today: string
  /** Shapes that point home to a request, read from the cycle rooms (ADR 0022). */
  shapes?: LinkedShape[]
  /** Which reports count towards pin size. Defaults to all of them. */
  lens?: HeatLens
  /** Cycle boundaries. Freshness counts cycles, so with none nothing ages. */
  cycles?: CycleWindow[]
  /** Overrides for the two freshness thresholds and the review cap. */
  freshness?: Partial<FreshnessConfig>
}): ProductMapModel {
  const areas = input.areas ?? []
  const lens = input.lens ?? DEFAULT_LENS
  const cycles = input.cycles ?? []
  const config = { ...DEFAULT_FRESHNESS, ...input.freshness }
  const shapesByRequest = groupShapesByRequest(input.shapes ?? [])
  const rendered = input.requests.map((f) =>
    renderPin(
      f,
      input.today,
      shapesByRequest.get(f.id) ?? [],
      lens,
      cycles,
      config,
      input.requests
    )
  )

  // A resolved request leaves the Product Map, because a person decided the problem is
  // gone. It is never deleted: it stays on its area, with the shapes that
  // resolved it.
  const resolved = rendered.filter((p) => p.state === 'resolved')
  const live = rendered.filter((p) => p.state !== 'resolved')

  // A dormant request leaves the view too. Past investment gets no say in this:
  // sunk cost must never set priority (ADR 0024).
  const pins = live.filter((p) => !p.dormant)
  const asleep = live.filter((p) => p.dormant)
  // The sweep runs at the end of a cycle, in cooldown, where housekeeping
  // already belongs — so the Product Map changes when somebody is looking.
  const dormantReview = inCooldown(cycles, input.today)
    ? asleep.slice(0, config.reviewQueueCap)
    : []

  const known = new Set(areas.map((a) => a.id))
  // A dangling area id is not a home, so the request falls to Unmapped rather
  // than vanishing with the area that used to hold it.
  const home = (pin: RenderedPin) => (known.has(pin.areaId) ? pin.areaId : '')
  const pinsByArea = groupBy(pins, home)
  const resolvedByArea = groupBy(resolved, home)

  return {
    pins,
    areas: buildAreaTree(areas, pinsByArea, resolvedByArea),
    unmapped: pinsByArea.get('') ?? [],
    // Unmapped is a home like any other, so a request resolved there stays on
    // record there. Otherwise resolving an Unmapped request would erase it from
    // the view, which is the one thing Resolve must never do.
    unmappedResolved: resolvedByArea.get('') ?? [],
    resolved,
    dormantReview,
  }
}

/**
 * One request, whatever its state. The request page has a URL, so it must open a
 * request the map no longer shows — dormant or resolved — and opening it never
 * wakes it (ADR 0024). null when no request has that id.
 */
export function renderRequest(
  input: Parameters<typeof renderProductMap>[0],
  requestId: string
): RenderedPin | null {
  const request = input.requests.find((f) => f.id === requestId)
  if (!request) return null
  return renderPin(
    request,
    input.today,
    (input.shapes ?? []).filter((s) => s.requestId === requestId),
    input.lens ?? DEFAULT_LENS,
    input.cycles ?? [],
    { ...DEFAULT_FRESHNESS, ...input.freshness },
    input.requests
  )
}

function groupBy(
  pins: RenderedPin[],
  key: (pin: RenderedPin) => string
): Map<string, RenderedPin[]> {
  const grouped = new Map<string, RenderedPin[]>()
  for (const pin of pins) {
    const bucket = grouped.get(key(pin))
    if (bucket) bucket.push(pin)
    else grouped.set(key(pin), [pin])
  }
  return grouped
}

function buildAreaTree(
  areas: Area[],
  pinsByArea: Map<string, RenderedPin[]>,
  resolvedByArea: Map<string, RenderedPin[]>
): RenderedArea[] {
  const known = new Set(areas.map((a) => a.id))
  const childrenOf = new Map<string, Area[]>()
  for (const area of areas) {
    const parent = area.parentAreaId
    if (!parent || !known.has(parent)) continue
    const siblings = childrenOf.get(parent)
    if (siblings) siblings.push(area)
    else childrenOf.set(parent, [area])
  }

  const drawn = new Set<string>()
  const render = (area: Area, depth: number): RenderedArea => {
    drawn.add(area.id)
    const shape = areaShape(area, depth)
    const children = (childrenOf.get(area.id) ?? [])
      .filter((child) => !drawn.has(child.id))
      .map((child) => render(child, depth + 1))
    // A container has NO ring of its own: its coastline is the merged silhouette
    // of the leaves under it, so generating a blob here would only put its label
    // and its box in the wrong place.
    const ring = children.length > 0 ? [] : areaRing(area, shape)
    const bounds = subtreeBounds(ring, children)
    const level = areaLevel(children)
    const pins = pinsByArea.get(area.id) ?? []
    // Assigned here rather than in renderPin, because a pin's spot depends on the
    // coastline it sits inside. These are the same objects the flat `pins` list
    // holds, so both surfaces agree on where a pin is.
    for (const pin of pins) pin.at = pinPosition(pin.requestId, ring)

    return {
      areaId: area.id,
      name: area.name,
      parentAreaId: area.parentAreaId ?? null,
      shape,
      ring,
      path: smoothPath(ring),
      // A leaf names itself from the inside. A container names itself just above
      // its coastline, where there are no pins to sit on top of.
      // An archipelago's name clears its islands' names, so the two levels do not
      // land on the same line.
      labelAt:
        children.length > 0
          ? [
              bounds.x + bounds.width / 2,
              bounds.y -
                (level === 'archipelago'
                  ? Math.max(34, bounds.height * 0.12)
                  : Math.max(12, bounds.height * 0.04)),
            ]
          : centroid(ring),
      bounds,
      level,
      owner: area.owner ?? null,
      pins,
      resolved: resolvedByArea.get(area.id) ?? [],
      children,
    }
  }

  // An area whose parent is gone is promoted rather than lost. The second pass
  // catches anything a parent loop left undrawn, so storage can never hide land.
  const roots = areas
    .filter((a) => !a.parentAreaId || !known.has(a.parentAreaId))
    .map((a) => render(a, 0))
  // Checked one at a time, because rendering one area draws its children too.
  const rescued: RenderedArea[] = []
  for (const area of areas) {
    if (!drawn.has(area.id)) rescued.push(render(area, 0))
  }
  return [...roots, ...rescued]
}

function areaShape(area: Area, depth: number): RenderedArea['shape'] {
  const scale = SUB_AREA_SCALE ** depth
  const width = AREA_WIDTH * scale
  const height = AREA_HEIGHT * scale
  return { x: area.x * (width + AREA_GAP), y: area.y * (height + AREA_GAP), width, height }
}

/** The drawn coastline, or one generated around the area's grid cell. */
function areaRing(area: Area, shape: RenderedArea['shape']): Ring {
  const drawn = area.outline
  // Two points cannot enclose anything, so a truncated outline falls back rather
  // than rendering a sliver nobody can click.
  if (Array.isArray(drawn) && drawn.length >= 3) return drawn.map(([x, y]) => [x, y] as Point)
  return generateRing(
    area.id,
    shape.x + shape.width / 2,
    shape.y + shape.height / 2,
    Math.min(shape.width, shape.height) / 2
  )
}

/** An area's box, widened to hold its children. The zoom ladder measures this. */
function subtreeBounds(ring: Ring, children: RenderedArea[]): Bounds {
  const own = ringBounds(ring)
  const boxes = [...(own ? [own] : []), ...children.map((c) => c.bounds)]
  return unionBounds(boxes) ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** Leaves are areas, what holds leaves is an island, what holds islands is an archipelago. */
function areaLevel(children: RenderedArea[]): AreaLevel {
  if (children.length === 0) return 'area'
  return children.some((c) => c.children.length > 0) ? 'archipelago' : 'island'
}

/** Kind, worst first. A bubble takes the worst Kind it holds, never an average. */
const KIND_SEVERITY: Record<RequestKind, number> = {
  brand_burn: 3,
  pain_point: 2,
  unlock_win: 1,
}

/** One thing to draw on the canvas: either an area with its pins, or a bubble standing in for it. */
export type CanvasNode =
  | { kind: 'area'; area: RenderedArea }
  | {
      kind: 'bubble'
      areaId: string
      name: string
      at: Point
      /** How many requests are asleep under this bubble. Never a report count. */
      count: number
      /** The worst Kind inside. */
      color: string
      /** From the FRESHEST request inside: a bubble never looks deader than its liveliest problem. */
      opacity: number
      /** Set if ANY request inside has work on it, because that is what a zoomed-out reader wants. */
      outline: PinOutline
    }

/** Below this many pixels on screen, an area collapses into a bubble. */
export const SPLIT_AT_PX = 200

/**
 * The zoom ladder. Walks the area tree and decides, per area, whether it is big
 * enough on screen to show its own contents or collapses into one numbered
 * bubble. Measured in RENDERED PIXELS, not in zoom steps, so a two-island map
 * splits early, a thirty-area map splits late, and there is no threshold to
 * retune as the map grows.
 *
 * Kept out of `renderProductMap` on purpose: this is the only thing that depends
 * on the viewport, which changes on every request of a pinch, and the rest of the
 * model does not need recomputing that often.
 */
export function clusterForViewport(
  areas: RenderedArea[],
  scale: number,
  splitAtPx: number = SPLIT_AT_PX
): CanvasNode[] {
  const nodes: CanvasNode[] = []
  const walk = (area: RenderedArea) => {
    const onScreen = Math.hypot(area.bounds.width, area.bounds.height) * scale
    // A bubble has to stand for MORE THAN ONE request. A bubble reading "1" hides a
    // pin behind a number and tells the reader nothing they could not already
    // see — and a pin holds its size on screen, so it stays legible however far
    // out the map is zoomed.
    if (onScreen < splitAtPx && countPins(area) > 1) {
      nodes.push(bubbleFor(area))
      return
    }
    // Big enough to open: draw this area's own land and pins, then its children,
    // each judged on its own size. Clustering never crosses an area boundary.
    nodes.push({ kind: 'area', area })
    for (const child of area.children) walk(child)
  }
  for (const area of areas) walk(area)
  return nodes
}

function bubbleFor(area: RenderedArea): CanvasNode {
  const pins = descendantPins(area).filter((p) => p.passesLens)
  const worst = pins.reduce<RequestKind>(
    (acc, pin) => (KIND_SEVERITY[pin.kind] > KIND_SEVERITY[acc] ? pin.kind : acc),
    'unlock_win'
  )
  const outlines = new Set(pins.map((p) => p.outline))
  return {
    kind: 'bubble',
    areaId: area.areaId,
    name: area.name,
    // The bounds centre, not `labelAt`: a container's label deliberately sits
    // above its coastline, which is not where the area is.
    at: [area.bounds.x + area.bounds.width / 2, area.bounds.y + area.bounds.height / 2],
    count: pins.length,
    color: KIND_COLORS[worst],
    // The freshest, not the mean: averaging turns every bubble the same mid-grey.
    opacity: pins.length === 0 ? MIN_OPACITY : Math.max(...pins.map((p) => p.opacity)),
    outline: outlines.has('solid') ? 'solid' : outlines.has('dashed') ? 'dashed' : 'none',
  }
}

/** Every awake pin under an area, its children included. */
/** Every area in the tree, parents before children, with how deep each sits. */
export function flattenAreas(
  areas: RenderedArea[],
  depth = 0
): { area: RenderedArea; depth: number }[] {
  return areas.flatMap((area) => [{ area, depth }, ...flattenAreas(area.children, depth + 1)])
}

export function descendantPins(area: RenderedArea): RenderedPin[] {
  return [...area.pins, ...area.children.flatMap(descendantPins)]
}

/**
 * How many awake requests under an area survive the lens. Cheaper than building
 * the list to measure it.
 */
function countPins(area: RenderedArea): number {
  return (
    area.pins.filter((p) => p.passesLens).length +
    area.children.reduce((sum, c) => sum + countPins(c), 0)
  )
}

function renderPin(
  request: ProductRequest,
  today: string,
  shapes: LinkedShape[],
  lens: HeatLens,
  cycles: CycleWindow[],
  config: FreshnessConfig,
  allRequests: ProductRequest[]
): RenderedPin {
  const kind = isRequestKind(request.kind) ? request.kind : DEFAULT_KIND
  const count = reportCount(request, lens)
  const days = daysBetween(request.last_woken, today)
  const elapsed = cyclesSinceWoken(request.last_woken, cycles, today)
  return {
    requestId: request.id,
    areaId: request.areaId ?? '',
    kind,
    type: request.type,
    problem: request.problem,
    appetite: request.appetite ?? '',
    businessCase: request.business_case ?? '',
    announcement: request.announcement ?? '',
    brief: request.brief ?? null,
    outcomes: statedOutcomes(request),
    owner: request.owner ?? null,
    raisedBy: request.raised_by ?? null,
    color: KIND_COLORS[kind],
    reports: withReportIds(request.reports ?? []),
    pointers: request.pointers ?? [],
    gaps: gapList(request),
    reportCount: count,
    passesLens: lens === 'all' || count > 0,
    size: pinSize(count),
    sharp: isSharp(request),
    state: requestState(request, shapes),
    outline: pinOutline(shapes),
    shapes,
    worked: shapes.length > 0,
    originChain: originChain(request, allRequests),
    related: relatedRequests(request, allRequests),
    candidateStatement: candidateStatement(request),
    daysSinceWoken: days,
    cyclesSinceWoken: elapsed,
    opacity: pinOpacity(days, cycles, config),
    dim: elapsed >= config.dimAfterCycles && elapsed < config.dormantAfterCycles,
    dormant: elapsed >= config.dormantAfterCycles,
    // Filled in when the area tree is built, because a pin's spot depends on the
    // coastline it sits inside. An Unmapped request keeps null and lives in the tray.
    at: null,
  }
}

function groupShapesByRequest(shapes: LinkedShape[]): Map<string, LinkedShape[]> {
  const byRequest = new Map<string, LinkedShape[]>()
  for (const shape of shapes) {
    const bucket = byRequest.get(shape.requestId)
    if (bucket) bucket.push(shape)
    else byRequest.set(shape.requestId, [shape])
  }
  return byRequest
}

/** Whole days from `from` to `to`, both ISO calendar dates. null if either is unreadable. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}
