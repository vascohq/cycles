import { LiveList, LiveObject } from '@liveblocks/client'

export type Zone = 'on_track' | 'some_risk' | 'concerned'

export type Stage = 'framing' | 'shaping' | 'building' | 'done'

export type Tier = 'must' | 'should' | 'could'

// A card's column in Kanban view (see ADR 0018). Optional on a stored task —
// legacy tasks predate it and derive their column from `done` via cardStatus.
export type CardStatus = 'todo' | 'doing' | 'done'

// How a pitch is rendered (see ADR 0018). A pure view toggle over the same
// data — switching never creates, deletes, or moves anything.
export type PitchView = 'scope_map' | 'kanban'

export type Needle = {
  progress: number
  zone: Zone
}

export type NeedleSnapshot = {
  progress: number
  zone: Zone
}

export type HillSnapshot = {
  scopeId: string
  hill_progress: number
  title?: string
  tier?: Tier
}

export type Squad = {
  id: string
  name: string
  color: string
}

export type CyclePitch = {
  id: string
  title: string
  stage: Stage
  needle: Needle | null
  frame_problem: string
  frame_outcome: string
  timebox_start: string
  timebox_end: string
  /** Identity emoji (single grapheme), or '' when unset. */
  emoji: string
  /** Outbound link to the pitch's Notion doc, or '' when unset. */
  notion_url: string
  // The squad that owns this pitch (per-cycle; see ADR 0009). Undefined = Unassigned.
  squadId?: string
  // Pointer to this pitch's Core Scope (see ADR 0012). Undefined = no core set;
  // a pointer to a since-deleted scope resolves to "no core" (dangling = unset).
  core_scope_id?: string
  // How this pitch is rendered (see ADR 0018). Undefined = 'scope_map' (legacy
  // pitches predate the field); switching is non-destructive.
  view?: PitchView
}

export type CycleScope = {
  id: string
  pitchId: string
  title: string
  tier: Tier
  litmus_text: string
  hill_progress: number
  color?: string
}

export type ScopeTask = {
  id: string
  // The scope this card belongs to. Optional (see ADR 0018): a task with no
  // scopeId is an Unscoped task ("awaiting triage"), parented only to the pitch.
  scopeId?: string
  // The pitch this card belongs to. Set on new tasks; legacy tasks predate it
  // and derive their pitch from their scope. Undefined only on un-migrated data.
  pitchId?: string
  title: string
  // Legacy binary completion. Card status is the source of truth in Kanban view;
  // `done` is kept in sync (done === status 'done') so existing counts/snapshots
  // keep working. Derive a column with cardStatus, never read `done` for columns.
  done: boolean
  // The card's Kanban column (see ADR 0018). Optional: legacy tasks lack it and
  // derive their column from `done`.
  status?: CardStatus
  // The single person responsible for this task (Clerk userId). Undefined =
  // Unassigned; a dangling id (member left the org) resolves to "Former member"
  // via resolveTaskAssignee. At most one assignee per task (see ADR 0017).
  assigneeId?: string
}

export type PitchUpdate = {
  id: string
  pitchId: string
  posted_at: string
  posted_by: string
  narrative: string
  needle_snapshot: NeedleSnapshot
  hill_snapshot: HillSnapshot[]
  task_snapshot: { scopeId: string; done: number; total: number }[]
  timebox_snapshot: { daysLeft: number; currentWeek: number; totalWeeks: number }
  slack_attempted?: boolean
  slack_delivered_at?: string
}

export type ParkingItem = {
  id: string
  pitchId: string
  text: string
  resolved: boolean
}

export type Cycle = {
  name: string
  type: 'build' | 'cooldown'
  start_date: string
  end_date: string
}

export type CycleStorage = {
  cycle: LiveObject<Cycle>
  pitches: LiveList<LiveObject<CyclePitch>>
  scopes: LiveList<LiveObject<CycleScope>>
  tasks: LiveList<LiveObject<ScopeTask>>
  updates: LiveList<LiveObject<PitchUpdate>>
  parkingItems: LiveList<LiveObject<ParkingItem>>
  squads: LiveList<LiveObject<Squad>>
}
