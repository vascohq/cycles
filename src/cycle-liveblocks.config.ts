import { LiveList, LiveObject } from '@liveblocks/client'

export type Zone = 'on_track' | 'some_risk' | 'concerned'

export type Stage = 'framing' | 'shaping' | 'building' | 'done'

export type Tier = 'must' | 'should' | 'could'

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
  scopeId: string
  title: string
  done: boolean
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
  slack_channel: string
}

export type CycleStorage = {
  cycle: LiveObject<Cycle>
  pitches: LiveList<LiveObject<CyclePitch>>
  scopes: LiveList<LiveObject<CycleScope>>
  tasks: LiveList<LiveObject<ScopeTask>>
  updates: LiveList<LiveObject<PitchUpdate>>
  parkingItems: LiveList<LiveObject<ParkingItem>>
}
