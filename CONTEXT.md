# Cycles

Cycles is a Shape Up project management tool. Teams work in fixed time-boxed cycles, shape pitches with clear problem/outcome frames, break work into vertical-slice scopes, and move the needle each week to communicate how things are going.

## Language

### Containers

**Cycle**:
A time-boxed period of work containing pitches. Either a build cycle (6 weeks) or a cooldown (2 weeks).
_Avoid_: Sprint, iteration, board

**Cycle phase**:
A cycle's lifecycle state — `upcoming`, `current`, or `past` — **derived purely from its dates** against today (the same `before`/`during`/`after` the cycle window already computes), never a stored field. There is no "active" flag and no "archive" action: a cycle becomes past by ending, not by a human toggling it. "Archiving" is only a _visual_ treatment (a past cycle folds/dims in the Cycles list), not a state change. Default landing resolves to the `current` cycle (see [ADR 0015](docs/adr/0015-cycle-lifecycle-is-date-derived.md)).
_Avoid_: Archive, archived, active/inactive, status, closed

**Cooldown**:
A short cycle (typically 2 weeks) between build cycles for small fixes and exploration. Pitches in a cooldown skip to the building stage.
_Avoid_: Buffer, break, maintenance window

**Cycle window**:
A cycle's own fixed time boundary — its start and end dates, and where today sits between them. Shown on Mission Control as a tape-measure strip with a "Week X of Y" label. Shares the visual of a pitch's timebox but is a distinct concept (see ADR 0010): the cycle window spans the whole cycle, a timebox bounds one pitch.
_Avoid_: Timebox (reserved for pitches), Sprint, deadline

### Calendar overlays

**Holiday**:
A statutory/public non-working day for a location (e.g. Canada, France), sourced from an external calendar feed. Location-wide — it applies to everyone in that location and is tied to no individual. Rendered as a read-only band on the **Cycle window**. Purely FYI: it never changes timebox or capacity math (overlay only — see ADR 0014).
_Avoid_: Day off, vacation, time off (those are personal — see **Time Off**)

**Time Off**:
An individual person's absence (vacation/leave), sourced from the Humi feed. Rendered as a read-only band on the **Cycle window**. In v1 it is shown as the *union* of everyone's absences with no per-person or per-pitch attribution (no person model, no name reconciliation — deferred). Purely FYI: never changes timebox or capacity math (overlay only — see ADR 0014).
_Avoid_: Holiday (reserved for statutory days — see Flagged ambiguities), PTO, leave, OOO

### Pitch lifecycle

**Pitch**:
A shaped piece of work within a cycle. Has a stage, timebox, frame, scopes, and a needle.
_Avoid_: Project, epic, initiative, ticket

**Stage**:
A pitch's current lifecycle phase: `framing`, `shaping`, `building`, `done`. Can move forward or backward. Cooldown pitches start at `building`. A pitch **auto-advances to `done`** when an update sets the **Needle** to 100% — posting a 100% update is the act of shipping.
_Avoid_: Status (ambiguous — see Flagged ambiguities)

**Frame**:
The problem/outcome definition of a pitch. Two columns: Problem (why this matters) and Outcome (what success looks like). "Frame Go" means both are defined.
_Avoid_: Brief, requirements, spec, PRD

**Timebox**:
The fixed time boundary of a pitch. Has start and end dates. Visualized as a tape-measure strip with day ticks and a "today" marker. For the cycle's own span, use **Cycle window** — not "timebox" (see ADR 0010). All of its math — days left, elapsed fill, "Week X of Y" — counts **business days**, not calendar days (see ADR 0013).
_Avoid_: Deadline, due date, sprint length

**Business day**:
A Monday–Friday working day. Weekends count as zero; public holidays are **not** modelled. Every timebox / cycle-window quantity (days left, day number, elapsed fraction, week count, tape ticks) is measured in business days. A countdown therefore holds flat across the weekend, and one tape tick = one working day, with a major tick every 5th to mark a week boundary. See ADR 0013.
_Avoid_: Working day (use "business day" consistently), calendar day

**Business week**:
Five business days. "Week X of Y" derives from `ceil(businessDays / 5)`, so a 6-week build cycle is 30 business days and a 2-week cooldown is 10. A ragged span rounds its final partial week up.

**Team timezone**:
The single canonical clock — `America/Montreal` — used to decide what "today" is everywhere in the app. "Days left" is a property of the **cycle**, not the viewer, so it is the same number for everyone (including remote teammates) and freezes unambiguously into update snapshots. Not per-user. See ADR 0013.
_Avoid_: Local time, user timezone, UTC (UTC midnight rolls over at 8pm Montreal)

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
A scope's intrinsic priority: `must`, `should`, or `could`. Shown as a small text badge (shadcn-style), not as color — the color channel now belongs to **Scope Color** (see [ADR 0008](docs/adr/0008-scope-identity-color.md)). Independent of build order — reordering scopes does not change their tier.
_Avoid_: Priority level, P0/P1/P2, severity

**Core Scope**:
The one scope flagged as the heart of a pitch — the vertical slice the team builds to reach GA on the central idea, chosen so risk surfaces early ("start in the middle"). At most one per pitch. A **third independent signal**, distinct from **Tier** and build order: the Core Scope is usually a Must and usually built first, but neither is required — a prerequisite scope or two can sit ahead of it on the path to GA, so build-order #1 is not necessarily the Core Scope. Flagging a scope as core does not change its tier or its position.
_Avoid_: Main scope, primary scope, MVP, key result, #1 scope

**Scope Color**:
A scope's unique identity color, used to tell scopes apart at a glance — painted on the order badge and the scope's dot on the hill chart. Chosen from a curated palette; the badge number flips between dark/light for contrast against the color. Auto-assigned (including via MCP) from an unused palette color when not set.
_Avoid_: Tier color, zone color, theme color

**Litmus Text**:
A scope's "if only this ships" statement. Tests whether the scope is a meaningful vertical slice that delivers value on its own.
_Avoid_: Description, acceptance criteria, definition of done

**Hill Progress**:
A scope's position on the hill chart (0..1). Left side (0–0.5) = figuring it out (unknown). Right side (0.5–1.0) = figured out, making it happen (known). Updated by dragging dots.
_Avoid_: Completion percentage, progress bar

**Done Scope**:
A scope whose Hill Progress is exactly `1` — dragged all the way to the foot of the downhill (the last step, 12/12). This is the only point a scope counts as "done"; anything less is still "making it happen". Distinct from the pitch **Stage** value `done` — a scope is never a Stage. Always qualify in conversation ("done scope" / "scope is done" vs. "pitch stage is done").
_Avoid_: Using bare "done" where it could mean the pitch Stage

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
An immutable record of a needle move. Contains the zone, needle progress, narrative text, and snapshots of all hill positions and task counts at post time. Posted to a shared Slack channel. Updates are always appended, never edited. They can be **deleted** only as a misfire undo — and only the latest update on a pitch — never as general history rewriting (see Delete Update).
_Avoid_: Check-in, standup note, status report

**Delete Update**:
The narrow escape hatch for undoing a misfired needle move (wrong pitch, fat-fingered position, duplicate post). Only the **latest** update on a pitch can be deleted; once another update is posted on top, the earlier one is sealed. Deleting reverts the pitch's needle to the prior update's Needle Snapshot (or `null` if it was the only update) so the on-page needle stays truthful; live scope hill positions are left untouched, and the needle Ghost and Hill Trails rebase onto the now-latest update automatically. Editing an update is never allowed — only delete-and-repost.
_Avoid_: Edit update, revise update, retract

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

### Squads

**Squad**:
A named, color-coded team that owns pitches within a cycle. A pitch belongs to zero or one squad. Squads are defined **per-cycle** (stored in the cycle's room), so a pitch's ownership is preserved historically for free and every new cycle starts with a fresh squad list. A squad has no member roster — people remain Clerk org users, tracked separately. Names are unique within a cycle, matched case-insensitively via slugify ("Platform", "platform", "  PLATFORM  " are the same squad); a rename that collides with another squad's name is rejected, never silently duplicated.
_Avoid_: Team (ambiguous with the Clerk organization), group, pod, roster

**Squad Color**:
A squad's identity color, used to tell squads apart across a cycle — shown on the squad chip (Scope Map), the squad's Mission Control section header, and each pitch card. Drawn from the same curated palette as **Scope Color** but a conceptually distinct concept: Squad Color groups pitches across a cycle, Scope Color distinguishes scopes within one pitch. Auto-assigned (hue-distant from sibling squads) when not chosen; overridable from the palette only — no free hex (parity with ADR 0008).
_Avoid_: Scope color, tier color, zone color, theme color

**Unassigned**:
The implicit bucket for pitches with no squad (`squadId` null) — not a stored squad. Always rendered last in Mission Control. Deleting a squad moves its pitches here rather than deleting them, so work is never lost by removing a team.
_Avoid_: No squad, null squad, default squad, backlog

### Views

**Mission Control**:
The overview surface showing all pitches in a cycle. Each pitch renders as a card with a mini needle, timebox tape, stage badge, and context note.
_Avoid_: Dashboard, board listing, overview page

**Scope Map**:
The per-pitch detail view. Shows hero card, needle, hill chart, scope grid, updates timeline, and parking lot.
_Avoid_: Pitch detail, pitch page

**Scope Card**:
A big-picture tile in the scope grid. Leads with the scope's name and its "what it ships" (Litmus Text); when the scope has tasks it shows a non-numeric **task presence indicator** (one tick per task, filling as tasks complete) — never a count or completion bar (see [ADR 0007](docs/adr/0007-scope-cards-show-task-presence-not-completion.md)). Clicking the card body opens the Scope Drawer.
_Avoid_: Story card, ticket, work-item card

**Scope Drawer**:
A right-side panel opened from a Scope Card. The single editor for one scope — its name, tier, Litmus Text, and tasks — using inline auto-save. Where all task management lives.
_Avoid_: Scope modal, scope detail dialog, side panel

## Relationships

- A **Cycle** contains one or more **Pitches**
- A **Pitch** has one **Needle** (nullable until first set), one **Timebox**, and one **Stage**
- A **Pitch** contains zero or more **Scopes** and zero or more **Parking Lot** items
- A **Scope** has one **Tier** and one **Hill Progress** value
- A **Pitch** has zero or one **Core Scope** (a pointer to one of its own scopes; see [ADR 0012](docs/adr/0012-core-scope-pitch-pointer.md))
- A **Scope** contains zero or more **Tasks**
- An **Update** belongs to one **Pitch** and captures a **Needle Snapshot** and a **Hill Snapshot**
- **Mission Control** renders all **Pitches** in a **Cycle**
- **Scope Map** renders one **Pitch** in detail
- A **Cycle** has one Slack channel; all pitch **Updates** in that cycle post there
- A **Cycle** contains zero or more **Squads**; a **Pitch** belongs to zero or one **Squad**
- **Mission Control** groups **Pitches** into a section per **Squad**, with **Unassigned** last
- Deleting a **Squad** moves its **Pitches** to **Unassigned** (never deletes them)

## Example dialogue

> **Dev:** "When a team moves the **Needle** to *concerned*, does that change the **Pitch**'s **Stage**?"
> **Domain expert:** "No — the **Needle** reflects the team's subjective impression. **Stage** tracks the lifecycle phase (framing → shaping → building → done). A pitch can be *on_track* in building or *concerned* in shaping — they're independent."

> **Dev:** "If I reorder scopes, does the first scope become a **Must**?"
> **Domain expert:** "No. **Tier** is intrinsic priority — it doesn't change when you reorder. The number on the dot is build order, the color is tier. They're independent signals."

> **Dev:** "Can someone edit a Tuesday **Update** after posting?"
> **Domain expert:** "No. **Updates** are immutable — you never revise what you felt at a sealed checkpoint. If something changes, post a new one. The timeline tells the honest story of how the team felt over time."

> **Dev:** "So an **Update** can never be removed?"
> **Domain expert:** "One exception: a misfire. If you just posted to the wrong pitch or fat-fingered the needle, you can **delete the latest** update — that's undoing a post that shouldn't have existed, not rewriting history. Only the latest, and the needle reverts to the previous update. Older updates are sealed."

## Flagged ambiguities

- **"status"** was used to mean both **Stage** (framing/shaping/building/done) and **Zone** (on_track/some_risk/concerned). Resolved: use "stage" for the pitch lifecycle phase, "zone" for the needle sentiment. Never use "status" unqualified.
- **"progress"** was used to mean both **Hill Progress** (scope-level, position on hill chart) and **Needle** progress (pitch-level, position on arc). Resolved: always qualify — "hill progress" for scopes, "needle progress" for the pitch-level arc position. Note: task completion is never "progress" — the **Scope Card** shows task *presence*, not a completion metric (see [ADR 0007](docs/adr/0007-scope-cards-show-task-presence-not-completion.md)).
- **"snapshot"** was used for the existing `PitchSnapshot` type (legacy board feature) and for the new update snapshots. Resolved: the legacy type is retired. New terms are **Needle Snapshot** and **Hill Snapshot**, both part of an **Update**.
- **"color"** historically meant tier color (red/orange/grey on scope dots) vs zone color (green/yellow/red on the needle). Resolved + superseded: tier is no longer color-encoded (it is now a text **badge**). The scope dot and order badge now show the scope's unique **Scope Color**; zone color still appears on the needle and update cards (see [ADR 0008](docs/adr/0008-scope-identity-color.md)).
- **"holiday"** is a terminology landmine: in British/French English it commonly means *personal vacation*, which here is **Time Off**. Resolved: **Holiday** = statutory/public non-working day for a location (from the CA/FR feeds); a person's vacation is always **Time Off** (from the Humi feed). Never use "holiday" for an individual's leave.
- **needle position vs. zone** were coupled: position was auto-snapped from the chosen zone (on_track→0.85, some_risk→0.5, concerned→0.2). Resolved: they are independent — position is slid manually, zone is chosen separately, and the snapping derivation is removed. The needle's filled arc encodes both at once: length = position, color = zone.
- **"team"** is ambiguous: it can mean the Clerk **organization** (the workspace tenant) or the per-cycle ownership label. Resolved: always use **Squad** for the per-cycle, color-coded group that owns pitches. Reserve "organization" for the Clerk tenant. Never use "team" unqualified in product copy or code.
