import type { HillSnapshot, Tier } from '@/cycle-liveblocks.config'

export type TrailLabel =
  | "Didn't move"
  | 'Nudged forward'
  | 'Lots of progress'
  | 'At the top'
  | 'Crossed the hill'
  | 'Heading down'
  | 'Done'
  | 'Slid back'
  | 'New'
  | 'Dropped'

export type ScopeTrail =
  | {
      scopeId: string
      state: 'moved' | 'stagnant'
      fromProgress: number
      toProgress: number
      stepDelta: number
      label: TrailLabel
    }
  | {
      scopeId: string
      state: 'new'
      toProgress: number
      label: TrailLabel
    }
  | {
      scopeId: string
      state: 'dropped'
      fromProgress: number
      title?: string
      tier?: Tier
      label: TrailLabel
    }

export type HillTrailRollup = {
  moved: number
  stalled: number
  new: number
  dropped: number
}

type TrailScope = { id: string; hill_progress: number }

export const HILL_STEP_COUNT = 14
const CREST_STEP = HILL_STEP_COUNT / 2

export function hillStepIndex(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return Math.round(clamped * HILL_STEP_COUNT)
}

// Label describes the delta against the hill metaphor: climb up the unknown
// side, reach the top (crest), cross over and head down the known side, and
// finally reach done. Never a verdict — a slide back is just movement.
function movedLabel(
  fromProgress: number,
  toProgress: number,
  stepDelta: number
): TrailLabel {
  if (stepDelta < 0) return 'Slid back'
  if (toProgress >= 0.999) return 'Done' // reached the bottom of the far side
  const fromStep = hillStepIndex(fromProgress)
  const toStep = hillStepIndex(toProgress)
  if (toStep === CREST_STEP) return 'At the top' // landed on the crest
  if (toStep > CREST_STEP) {
    // On the downhill / known side: distinguish the moment of crossing.
    return fromStep <= CREST_STEP ? 'Crossed the hill' : 'Heading down'
  }
  // Still climbing the unknown side.
  return stepDelta >= 3 ? 'Lots of progress' : 'Nudged forward'
}

export function rollupHillTrails(trails: ScopeTrail[]): HillTrailRollup {
  return {
    moved: trails.filter((t) => t.state === 'moved').length,
    stalled: trails.filter((t) => t.state === 'stagnant').length,
    new: trails.filter((t) => t.state === 'new').length,
    dropped: trails.filter((t) => t.state === 'dropped').length,
  }
}

// How many consecutive past updates each live scope has held its current hill
// step. Walks snapshots newest→oldest, counting matches until the step changes
// or the scope is absent. 0 means it moved since the last update. The number is
// reported as a neutral fact — long streaks signal "quiet", never a verdict.
export function noChangeStreaks(
  snapshotsNewestFirst: HillSnapshot[][],
  liveScopes: TrailScope[]
): Map<string, number> {
  const streaks = new Map<string, number>()
  for (const scope of liveScopes) {
    const liveStep = hillStepIndex(scope.hill_progress)
    let streak = 0
    for (const snapshot of snapshotsNewestFirst) {
      const prev = snapshot.find((s) => s.scopeId === scope.id)
      if (!prev || hillStepIndex(prev.hill_progress) !== liveStep) break
      streak++
    }
    streaks.set(scope.id, streak)
  }
  return streaks
}

const NAMED_CAP = 3 // most movers named before overflowing to "+N more"
const QUIET_NAME_CAP = 3 // most longest-streak names listed for the quiet group
const BIG_MOVE_STEPS = 3 // step delta that counts as a "big" climb / slide

// Emoji vocabulary for the hill metaphor — magnitude and stage are built in.
const EMOJI = {
  done: '🎉',
  atTop: '⛰️',
  crossed: '🏂',
  bigClimb: '⏫',
  nudge: '🔼',
  slidBack: '🔻',
  slidWayBack: '⏬',
  unchanged: '⏸️',
  new: '🆕',
  dropped: '❌',
} as const

function trailTitle(trail: ScopeTrail, titles: Map<string, string>): string {
  const fromMap = titles.get(trail.scopeId)
  if (fromMap) return fromMap
  if ('title' in trail && trail.title) return trail.title
  return trail.scopeId
}

// A single mover rendered with its emoji. Small forward nudges return kind
// 'nudge' so they can be collapsed into one count; everything else is 'named'.
function moverSegment(
  trail: ScopeTrail,
  titles: Map<string, string>
): { kind: 'named' | 'nudge'; text: string } | null {
  const name = trailTitle(trail, titles)
  if (trail.state === 'new') return { kind: 'named', text: `${EMOJI.new} ${name}` }
  if (trail.state === 'dropped') return { kind: 'named', text: `${EMOJI.dropped} ${name}` }
  if (trail.state !== 'moved') return null

  const d = trail.stepDelta
  switch (trail.label) {
    case 'Done':
      return { kind: 'named', text: `${EMOJI.done} ${name} done!` }
    case 'At the top':
      return { kind: 'named', text: `${EMOJI.atTop} ${name} at the top` }
    case 'Crossed the hill':
      return { kind: 'named', text: `${EMOJI.crossed} ${name} crossed the hill` }
    case 'Heading down':
      return { kind: 'named', text: `${EMOJI.crossed} ${name} heading down` }
    case 'Lots of progress':
      return { kind: 'named', text: `${EMOJI.bigClimb} ${name} big climb` }
    case 'Nudged forward':
      return { kind: 'nudge', text: name }
    case 'Slid back':
      return d <= -BIG_MOVE_STEPS
        ? { kind: 'named', text: `${EMOJI.slidWayBack} ${name} slid way back` }
        : { kind: 'named', text: `${EMOJI.slidBack} ${name} slid back` }
    default:
      return null
  }
}

// Builds the digestible hill-movement summary: an emoji-led line naming the
// movers (small nudges collapsed into a count, the rest capped with "+N more"),
// and a separate line that collapses the quiet scopes into a count while naming
// only the longest no-change streaks. Returns null when there's nothing to say.
export function summarizeMovement(
  trails: ScopeTrail[],
  streaks: Map<string, number>,
  titles: Map<string, string>
): string | null {
  if (trails.length === 0) return null

  const named: string[] = []
  let nudges = 0
  for (const trail of trails) {
    const seg = moverSegment(trail, titles)
    if (!seg) continue
    if (seg.kind === 'nudge') nudges++
    else named.push(seg.text)
  }
  const moverSegments =
    named.length > NAMED_CAP
      ? [...named.slice(0, NAMED_CAP), `+${named.length - NAMED_CAP} more`]
      : [...named]
  if (nudges > 0) moverSegments.push(`${EMOJI.nudge} +${nudges} nudged`)
  const moversLine = moverSegments.join(' · ')

  const quiet = trails
    .filter((t) => t.state === 'stagnant')
    .map((t) => ({ name: trailTitle(t, titles), streak: streaks.get(t.scopeId) ?? 1 }))
    .sort((a, b) => b.streak - a.streak)

  // No quiet scopes: just the movers line (always present here, since trails
  // is non-empty and nothing was stagnant).
  if (quiet.length === 0) return moversLine || null

  const maxStreak = quiet[0].streak
  const longestNames = quiet
    .filter((q) => q.streak === maxStreak)
    .slice(0, QUIET_NAME_CAP)
    .map((q) => q.name)
  const longest =
    maxStreak >= 2 ? `longest ${maxStreak} updates: ${longestNames.join(', ')}` : ''

  // Nothing moved at all — lead with that, put the longest-quiet detail on its
  // own line, and note how many quiet scopes weren't named.
  if (moverSegments.length === 0) {
    const head = `${EMOJI.unchanged} No hill movement · ${quiet.length} unchanged`
    if (!longest) return head
    const extra = quiet.length - longestNames.length
    return `${head}\n${longest}${extra > 0 ? ` (+${extra})` : ''}`
  }

  const quietLine = `${EMOJI.unchanged} ${quiet.length} unchanged${longest ? ` · ${longest}` : ''}`
  return `${moversLine}\n${quietLine}`
}

export function diffHillTrail(
  previous: HillSnapshot[],
  current: TrailScope[]
): ScopeTrail[] {
  const trails: ScopeTrail[] = []
  for (const scope of current) {
    const prev = previous.find((p) => p.scopeId === scope.id)
    if (!prev) {
      trails.push({
        scopeId: scope.id,
        state: 'new',
        toProgress: scope.hill_progress,
        label: 'New',
      })
      continue
    }
    const stepDelta =
      hillStepIndex(scope.hill_progress) - hillStepIndex(prev.hill_progress)
    trails.push({
      scopeId: scope.id,
      state: stepDelta === 0 ? 'stagnant' : 'moved',
      fromProgress: prev.hill_progress,
      toProgress: scope.hill_progress,
      stepDelta,
      label:
        stepDelta === 0
          ? "Didn't move"
          : movedLabel(prev.hill_progress, scope.hill_progress, stepDelta),
    })
  }
  for (const prev of previous) {
    if (current.some((s) => s.id === prev.scopeId)) continue
    trails.push({
      scopeId: prev.scopeId,
      state: 'dropped',
      fromProgress: prev.hill_progress,
      ...(prev.title !== undefined ? { title: prev.title } : {}),
      ...(prev.tier !== undefined ? { tier: prev.tier } : {}),
      label: 'Dropped',
    })
  }
  return trails
}
