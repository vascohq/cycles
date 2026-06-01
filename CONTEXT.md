# Cycles

Cycles is a Shape Up project management tool. Teams work in fixed time-boxed cycles, shape pitches with clear problem/outcome frames, break work into vertical-slice scopes, and move the needle each week to communicate how things are going.

## Language

### Containers

**Cycle**:
A time-boxed period of work containing pitches. Either a build cycle (6 weeks) or a cooldown (2 weeks).
_Avoid_: Sprint, iteration, board

**Cooldown**:
A short cycle (typically 2 weeks) between build cycles for small fixes and exploration. Pitches in a cooldown skip to the building stage.
_Avoid_: Buffer, break, maintenance window

### Pitch lifecycle

**Pitch**:
A shaped piece of work within a cycle. Has a stage, timebox, frame, scopes, and a needle.
_Avoid_: Project, epic, initiative, ticket

**Stage**:
A pitch's current lifecycle phase: `framing`, `shaping`, `building`, `done`. Can move forward or backward. Cooldown pitches start at `building`.
_Avoid_: Status (ambiguous — see Flagged ambiguities)

**Frame**:
The problem/outcome definition of a pitch. Two columns: Problem (why this matters) and Outcome (what success looks like). "Frame Go" means both are defined.
_Avoid_: Brief, requirements, spec, PRD

**Timebox**:
The fixed time boundary of a pitch. Has start and end dates. Visualized as a tape-measure strip with day ticks and a "today" marker.
_Avoid_: Deadline, due date, sprint length

### The Needle

**Needle**:
The team's subjective impression of how a pitch is going. Two independent dimensions: a **position** on an arc (0..1, "how far along") set by sliding, and a **zone** (sentiment, rendered as color) chosen separately. Neither derives from the other. Intentionally manual — never calculated from scope progress, task counts, or each other.
_Avoid_: Gauge, status indicator, health check

**Zone**:
The needle's sentiment: `on_track`, `some_risk`, or `concerned`. Rendered as color (green, yellow, red). A null needle (not yet set) renders as grey.
_Avoid_: Status, RAG status, health

**Move the Needle**:
The action of updating a pitch's needle and posting a narrative update. Done only in the dedicated modal — the on-page needle is display-only, never edited in place. Requires placing the position, choosing a zone, and writing narrative; the modal pre-fills position and zone to the current needle so you adjust from where it is. Can happen any day but follows a Tuesday cadence. Always creates an immutable update — never edits a previous one.
_Avoid_: Check-in, standup, status update

### Scopes and tasks

**Scope**:
A vertical slice of work within a pitch. Has a tier, litmus text, hill progress, and tasks.
_Avoid_: Story, work item, feature

**Tier**:
A scope's intrinsic priority: `must`, `should`, or `could`. Encoded as color (red, orange, grey). Independent of build order — reordering scopes does not change their tier.
_Avoid_: Priority level, P0/P1/P2, severity

**Litmus Text**:
A scope's "if only this ships" statement. Tests whether the scope is a meaningful vertical slice that delivers value on its own.
_Avoid_: Description, acceptance criteria, definition of done

**Hill Progress**:
A scope's position on the hill chart (0..1). Left side (0–0.5) = figuring it out (unknown). Right side (0.5–1.0) = figured out, making it happen (known). Updated by dragging dots.
_Avoid_: Completion percentage, progress bar

**Hill Chart**:
Visualization of all scopes' hill progress on a hill-shaped curve. Each scope is a numbered, tier-colored dot. Left = unknown, right = known.
_Avoid_: Burndown, velocity chart

**Hill Trail**:
A scope's movement since the last update, drawn on the hill chart: a dimmed ghost dot at its prior position, a neutral curve-following line, and the live dot at its current position. Trail geometry tells the story — long rightward = lots of progress, leftward = slid back, no trail = didn't move. Crossing the crest (step 7 / 0.5) is "over the hill". Regression is never colored as alarming; the chart shows movement, it does not judge it. A new scope (absent from the last snapshot) shows a dashed halo and no trail; a dropped scope (in the last snapshot, since deleted) shows a lone named ghost that self-expires after the next update.
_Avoid_: Diff, delta, change indicator

**Task**:
A checklist item within a scope. Binary: done or not done. No assignee, no type, no intermediate states.
_Avoid_: Subtask, to-do, issue, ticket

**Parking Lot**:
Open decisions on a pitch that need resolving but aren't scopes. Not work items — questions and choices.
_Avoid_: Backlog, blockers, open questions list

### Updates

**Update**:
An immutable record of a needle move. Contains the zone, needle progress, narrative text, and snapshots of all hill positions and task counts at post time. Posted to a shared Slack channel. Updates are always appended, never edited.
_Avoid_: Check-in, standup note, status report

**Ghost**:
A dimmed marker showing where something sat at the last update — the needle's prior position on the arc, or a scope's prior dot on the hill chart. Always sourced from a frozen snapshot, never from live state.
_Avoid_: Shadow, history dot

**Needle Snapshot**:
The needle's progress and zone frozen at the time an update was posted. Used to render the "ghost" showing where the needle was at the last update.
_Avoid_: Previous state

**Hill Snapshot**:
Every scope's hill progress — plus its title and tier — frozen at the time an update was posted. Each update holds exactly one. The diff between consecutive Hill Snapshots (or the latest snapshot vs. the live positions) drives the trail rendering on the hill chart. Title and tier are frozen so a scope deleted since the snapshot can still render a named ghost.
_Avoid_: Scope snapshot (conflicts with existing PitchSnapshot)

**Hill History**:
The arrow-scrubbable sequence of past Hill Snapshots. Stepping back shows a read-only historical frame — that update's positions with the trail from the update before it. There is no continuous log of every drag; the heartbeat is the needle update, so history advances one update at a time.
_Avoid_: Timeline (reserved for the updates feed), movement log, playback

### Views

**Mission Control**:
The overview surface showing all pitches in a cycle. Each pitch renders as a card with a mini needle, timebox tape, stage badge, and context note.
_Avoid_: Dashboard, board listing, overview page

**Scope Map**:
The per-pitch detail view. Shows hero card, needle, hill chart, scope grid, updates timeline, and parking lot.
_Avoid_: Pitch detail, pitch page

## Relationships

- A **Cycle** contains one or more **Pitches**
- A **Pitch** has one **Needle** (nullable until first set), one **Timebox**, and one **Stage**
- A **Pitch** contains zero or more **Scopes** and zero or more **Parking Lot** items
- A **Scope** has one **Tier** and one **Hill Progress** value
- A **Scope** contains zero or more **Tasks**
- An **Update** belongs to one **Pitch** and captures a **Needle Snapshot** and a **Hill Snapshot**
- **Mission Control** renders all **Pitches** in a **Cycle**
- **Scope Map** renders one **Pitch** in detail
- A **Cycle** has one Slack channel; all pitch **Updates** in that cycle post there

## Example dialogue

> **Dev:** "When a team moves the **Needle** to *concerned*, does that change the **Pitch**'s **Stage**?"
> **Domain expert:** "No — the **Needle** reflects the team's subjective impression. **Stage** tracks the lifecycle phase (framing → shaping → building → done). A pitch can be *on_track* in building or *concerned* in shaping — they're independent."

> **Dev:** "If I reorder scopes, does the first scope become a **Must**?"
> **Domain expert:** "No. **Tier** is intrinsic priority — it doesn't change when you reorder. The number on the dot is build order, the color is tier. They're independent signals."

> **Dev:** "Can someone edit a Tuesday **Update** after posting?"
> **Domain expert:** "No. **Updates** are immutable. If something changes, post a new one. The timeline tells the honest story of how the team felt over time."

## Flagged ambiguities

- **"status"** was used to mean both **Stage** (framing/shaping/building/done) and **Zone** (on_track/some_risk/concerned). Resolved: use "stage" for the pitch lifecycle phase, "zone" for the needle sentiment. Never use "status" unqualified.
- **"progress"** was used to mean both **Hill Progress** (scope-level, position on hill chart) and **Needle** progress (pitch-level, position on arc). Resolved: always qualify — "hill progress" for scopes, "needle progress" for the pitch-level arc position.
- **"snapshot"** was used for the existing `PitchSnapshot` type (legacy board feature) and for the new update snapshots. Resolved: the legacy type is retired. New terms are **Needle Snapshot** and **Hill Snapshot**, both part of an **Update**.
- **"color"** was used for tier color (red/orange/grey on scope dots) and zone color (green/yellow/red on the needle). These overlap on red. Resolved: context distinguishes them — tier colors appear on scope dots and cards, zone colors appear on the needle and update cards. Tier red = highest priority, zone red = concerned.
- **needle position vs. zone** were coupled: position was auto-snapped from the chosen zone (on_track→0.85, some_risk→0.5, concerned→0.2). Resolved: they are independent — position is slid manually, zone is chosen separately, and the snapping derivation is removed. The needle's filled arc encodes both at once: length = position, color = zone.
