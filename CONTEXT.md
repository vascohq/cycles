# Cycles

Cycles is a Shape Up project management tool. Teams work in fixed time-boxed cycles, shape pitches with clear problem/outcome frames, break work into vertical-slice scopes, and move the needle each week to communicate how things are going.

## Language

### Containers

**Cycle**:
A time-boxed period of work containing pitches. Either a build cycle (6 weeks) or a cooldown (2 weeks).
_Avoid_: Sprint, iteration, board

**Cycle phase**:
A cycle's lifecycle state — `upcoming`, `current`, or `past` — **derived purely from its dates** against today (the same `before`/`during`/`after` the cycle window already computes), never a stored field. There is no "active" flag: a cycle becomes past by ending, not by a human toggling it. A past cycle simply _folds_ (collapses/dims) in the Cycles list — that folding is presentation, not state. Default landing resolves to the `current` cycle (see [ADR 0015](docs/adr/0015-cycle-lifecycle-is-date-derived.md)). Distinct from **Archive**, which is an explicit stored override orthogonal to phase.
_Avoid_: active/inactive, status, closed. Don't conflate `past` (date-derived) with **Archived** (a deliberate action).

**Archive**:
An explicit, **reversible** action that removes a cycle — and everything in it (pitches, scopes, tasks, updates, squads) — from the Cycles list and from default-landing resolution, **without deleting anything**. A stored flag independent of the date-derived **Cycle phase**: any cycle can be archived (mistake, experiment) or unarchived regardless of whether it's upcoming/current/past. Archived cycles collect in their own collapsed section and can be **unarchived** to return them to their date-derived group. A cycle is never permanently deleted — archiving is the only way to remove one (see ADR 0019). Contrast with the _visual folding_ of past cycles, which is not archiving.
_Avoid_: Delete/remove (for cycles — archive is reversible, delete is not), hide (implies purely visual), trash

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
The fixed time boundary of a pitch. Has start and end dates — but is **optional**: a pitch may have no timebox, in which case its tape is hidden (never "Invalid Date") and it draws no bar on the **Pitch timeline**. Visualized as a tape-measure strip with day ticks and a "today" marker. For the cycle's own span, use **Cycle window** — not "timebox" (see ADR 0010). All of its math — days left, elapsed fill, "Week X of Y" — counts **business days**, not calendar days (see ADR 0013).
_Avoid_: Deadline, due date, sprint length

**Business day**:
A Monday–Friday working day. Weekends count as zero; public holidays are **not** modelled. Every timebox / cycle-window quantity (days left, day number, elapsed fraction, week count, tape ticks) is measured in business days. A countdown therefore holds flat across the weekend, and one tape tick = one working day, with a major tick every 5th to mark a week boundary. See ADR 0013.
_Avoid_: Working day (use "business day" consistently), calendar day

**Business week**:
Five business days. "Week X of Y" derives from `ceil(businessDays / 5)`, so a 6-week build cycle is 30 business days and a 2-week cooldown is 10. A ragged span rounds its final partial week up.

**Team timezone**:
The single canonical clock — `America/Montreal` — used to decide what "today" is everywhere in the app. "Days left" is a property of the **cycle**, not the viewer, so it is the same number for everyone (including remote teammates) and freezes unambiguously into update snapshots. Not per-user. See ADR 0013.
_Avoid_: Local time, user timezone, UTC (UTC midnight rolls over at 8pm Montreal)

### Kanban mode vs Kanban view

**Kanban mode**:
A property of the **Pitch**, **derived from its Timebox**: a pitch with **no timebox** (= no appetite) is in Kanban mode. A Kanban-mode pitch is **board-only** — it never shows a needle, hill, or scope map, and shows **no view switcher** (there's nothing else to render). This is the "pure kanban pitch": flow work with no fixed clock or finish line (see ADR 0018). Give it a timebox and it becomes a Shape-Up pitch.
_Avoid_: Kanban project, board pitch, continuous pitch

**Pitch view**:
For a **Shape-Up pitch** (one that *has* a timebox), which work surface is shown below its needle/hill — a stored, switchable `view` field: `scope_map` or `kanban`. A **pure view toggle over the same data**: switching never creates, deletes, or moves anything. The **needle and hill always stay** for a Shape-Up pitch; the view only swaps the surface beneath them — **Scope Map view** shows the scope grid, **Kanban view** shows the board. (Contrast **Kanban mode** — no timebox — which has no needle/hill at all.) The **switcher only appears on Shape-Up pitches**; a Kanban-*mode* pitch has nothing to switch to. Stored team-wide (not per-viewer, unlike the ephemeral **Scope Drawer** filters); defaults to `scope_map`. So Kanban is reachable two ways: a **mode** (no timebox → board only, no needle/hill) and a **view** (a Shape-Up pitch keeps its needle/hill and shows the board instead of the scope grid).
_Avoid_: Conflating mode and view; project type, board type

**Kanban view**:
The board rendering of a pitch: its cards (**Tasks**) shown in fixed status columns (`todo` / `doing` / `done`) instead of under scopes. A card's **scope shows as a colored tag** (reusing **Scope Color**) when it has one; an **Unscoped task** shows untagged. Cards from all scopes intermix within a column — scope is a *tag*, **not** a swimlane (a scopes-as-swimlanes × status grid is a deferred, larger layout). The needle and hill are hidden; the **Timebox** is still optional and the **Cycle window** still bounds the pitch. A "pure kanban" pitch is just one created in this view that never gets scopes or a needle. Deliberately diverges from Vasco's Kanban methodology doc: (1) the doc says Kanban flows *continuously across* cycle boundaries — here it is cycle-bound, to keep clean-slate; (2) the doc keeps hill charts for Kanban — here the hill is hidden. Often used for cooldown work and triage-style flow.
_Avoid_: Kanban project, kanban mode, continuous pitch, swimlane (v1 uses tags)

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
A checklist item within a scope. Still binary: done or not done, no intermediate states. **May have an assignee** — a person (Clerk org user) responsible for it. The original "no assignee, no type" rule was a deliberate _keep-it-dumb-until-there's-pull_ stance; assignment was promoted to a first-class field once devs started faking it with `BE/Simon`-style title prefixes (see Flagged ambiguities). A task is never a sub-pitch or a routed ticket — it stays a lightweight checklist line that now also says _who_ (see [ADR 0017](docs/adr/0017-tasks-carry-a-single-assignee.md)).
_Avoid_: Subtask, to-do, issue, ticket

**Card status**:
A task's column on a Kanban board: `todo`, `doing`, or `done`. A fixed three-column enum (no custom columns). The legacy binary `done` is now *derived* (`status === 'done'`), so existing done-counts and snapshots keep working. Intermediate state (`doing`) exists **only** as a board column — a task is still rendered as a plain done/not-done checklist line in the Scope Drawer; the column is the Kanban surface, not a new task lifecycle everywhere. WIP limits (Vasco's "2–3 in progress") are a future concern, not modelled yet.
_Avoid_: Workflow state, stage (reserved for pitches), swimlane

**Unscoped task**:
A task that belongs to a **Pitch** but to **no scope** — `scopeId` is unset, `pitchId` points to the pitch. The "awaiting triage / not sure which scope" inbox. Every card in a **Kanban pitch** is unscoped (it has no scopes at all); a **Shape Up pitch** may also hold a few unscoped cards pending triage into a scope. Note: per-scope **update** snapshots (`task_snapshot`) don't yet count unscoped tasks — deferred.
_Avoid_: Orphan task, loose task, backlog item

**Triage tray**:
Where **Unscoped tasks** surface in **Scope Map view** (in **Kanban view** they simply appear untagged). A small section on the Scope Map listing the pitch's unscoped cards, each with an "assign to a scope" affordance — the place you clear "awaiting triage" work. **Self-hides entirely when empty** (consistent with the **Scope Drawer**'s self-hiding filters), so it is never a standing list. This is the deliberate edge of the **No Backlog, No Noise** principle: it exists only while there's untriaged work nudging you to clear it, never as a permanent holding pen. No size cap in v1 (a count/warning is a possible future nudge).
_Avoid_: Backlog, inbox (implies a permanent list), holding pen

**Assignee**:
The one person responsible for a **Task** — a single, nullable pointer to a Clerk org user (`assigneeId`, undefined = **Unassigned**). At most one per task: if two people genuinely own distinct work, that is two tasks. The assignable set is the cycle's current org members (the same `OrganizationUser` faces already rendered on Scope Map / Mission Control); no per-task name snapshot is stored — the avatar/initials resolve live from `assigneeId`. Mirrors the **Core Scope** pointer pattern: a dangling id (assignee left the org) resolves to **Former member**, never an "Unknown user" with a fabricated name.
_Avoid_: Owner (reserved tone for Squad ownership), reviewer, multiple assignees

**Unassigned (task)**:
A task with no `assigneeId` — nobody has claimed it yet. Rendered as an empty/dashed avatar slot that invites picking an assignee. Distinct from **Former member**: unassigned means _never claimed_, not _claimed by someone now gone_.
_Avoid_: Conflating with **Former member** or with the squad-level **Unassigned** bucket

**Former member**:
The state of a task whose `assigneeId` no longer matches any current org member (the person left the org, or the cycle was reopened/cloned past their membership). We cannot reliably tell account-deactivation from org-removal, so the honest meaning is _no longer a member of this org_ — never "deactivated". Rendered as an **anonymous** dimmed/greyed ghost avatar with a person-minus glyph, clickable to reassign; no name is shown because none is stored. Flags work that needs re-homing, as opposed to work never claimed (**Unassigned**).
_Avoid_: Deactivated, deleted user, Unknown user, ex-employee

**Parking Lot**:
Open decisions on a pitch that need resolving but aren't scopes. Not work items — questions and choices.
_Avoid_: Backlog, blockers, open questions list

### Updates

**Update**:
An immutable record of a needle move. Contains the zone, needle progress, narrative text, and snapshots of all hill positions and task counts at post time. Posted to a shared Slack channel. Updates are always appended, never edited. They can be **deleted** only as a misfire undo — and only the latest update on a pitch — never as general history rewriting (see Delete Update).
_Avoid_: Check-in, standup note, status report

**Updates (Kanban mode)**:
A **Kanban-mode** pitch (no timebox) has **no Updates** at all — no feed, no posting. Updates are the heartbeat of a Shape-Up pitch (a needle move over a timebox); with no timebox there is nothing to update against, and the **board itself is the status**. So "no timebox ⇒ no updates" (decided after an earlier card-diff exploration was dropped). A Shape-Up pitch *viewed* as Kanban still keeps its needle and Updates.
_Avoid_: Needle update (a kanban pitch has no needle), card log

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
A squad's identity color, used to tell squads apart across a cycle — shown on the squad chip (Scope Map), the squad's Mission Control section header, and each pitch row / timebox bar. Drawn from the same curated palette as **Scope Color** but a conceptually distinct concept: Squad Color groups pitches across a cycle, Scope Color distinguishes scopes within one pitch. Auto-assigned (hue-distant from sibling squads) when not chosen; overridable from the palette only — no free hex (parity with ADR 0008).
_Avoid_: Scope color, tier color, zone color, theme color

**Unassigned**:
The implicit bucket for pitches with no squad (`squadId` null) — not a stored squad. Always rendered last in Mission Control. Deleting a squad moves its pitches here rather than deleting them, so work is never lost by removing a team.
_Avoid_: No squad, null squad, default squad, backlog

**Pitch timeline**:
The Mission Control pitch list rendered as a timeline. Pitches are grouped by squad (declared squad order, **Unassigned** last); each is a two-line row — a header (mini **Needle**, title, **Stage** badge) and its **Timebox** as a bar on a shared cycle-window scale measured in business days (ADR 0013). Every bar shares one grid with the aligned **Cycle window** strip above, so a single *today* ("now") line runs down the whole view. A **done** pitch is struck through, dimmed, and sorts to the bottom of its squad; a pitch with no **Timebox** shows "no timebox" (a timebox is optional). Bars are colored by **Squad Color**; each row links to that pitch's **Scope Map**. The view narrows with the **SquadFilterBar**. *Derived* at render time from pitches + squads; never stored. See [ADR 0016](docs/adr/0016-mission-control-pitch-timeline.md).
_Avoid_: Card grid, Gantt, board, pitch band, squad span

### Views

**Mission Control**:
The overview surface showing all pitches in a cycle, rendered as a **Pitch timeline** grouped by squad: each pitch is a row with a mini needle, title, stage badge, and its **Timebox** drawn as a bar on the cycle's shared scale (aligned to the **Cycle window** strip above, with one "now" line down the page).
_Avoid_: Dashboard, board listing, overview page

**Scope Map**:
The per-pitch detail view. Shows hero card, needle, hill chart, scope grid, updates timeline, and parking lot.
_Avoid_: Pitch detail, pitch page

**Scope Card**:
A big-picture tile in the scope grid. Leads with the scope's name and its "what it ships" (Litmus Text); when the scope has tasks it shows a non-numeric **task presence indicator** (one tick per task, filling as tasks complete) — never a count or completion bar (see [ADR 0007](docs/adr/0007-scope-cards-show-task-presence-not-completion.md)). Also shows a **deduped assignee cluster** — the distinct people across the scope's tasks, capped to a few faces + "+N". This is an _identity_ signal (who's on it), not a completion signal, so it sits within ADR 0007's boundary, not against it. Clicking the card body opens the Scope Drawer.
_Avoid_: Story card, ticket, work-item card

**Scope Drawer**:
A right-side panel opened from a Scope Card. The single editor for one scope — its name, tier, Litmus Text, and tasks — using **Inline auto-save**, so dismissing the drawer (including clicking the backdrop) mid-edit commits the pending change rather than losing it. Where all task management lives, including each task's **Assignee** (a per-row avatar + picker drawn from the cycle's org members). Each task row follows a three-part shape borrowed from Linear's row rhythm but with this tool's semantics — `[done-circle] [title, wraps to full text] [assignee avatar]` — where Linear puts a status icon, we put the binary done-circle (no workflow states). The picker is a cmdk type-ahead (reusing `ui/command.tsx` + the `squad-picker` pattern). Its task list can be narrowed by two **drawer-local filters** — an **All / Open** toggle (Open = not done; never "active") and a **by-assignee** filter. These are ephemeral per-viewer view state (never stored in Liveblocks — a filter must not change a collaborator's screen), each control self-hides when there's no choice to make (assignee filter only with >1 assignee present; All/Open toggle only when ≥1 task is done), and filtering never alters the Scope Card's true presence ticks or assignee cluster.

**Inline auto-save**:
The commit rule for editable fields. An editor with **no Save CTA** treats clicking away as the commit — blurring, or dismissing the surrounding surface (e.g. the Scope Drawer backdrop), saves the pending edit; only Escape discards. An editor **with a Save CTA** (an explicit Save/Create button) is the opposite: the button or Enter commits, and dismissing the surface discards. Creating a new entity uses an explicit CTA (so an accidental click-out never spawns a junk pitch or scope); editing an existing field uses inline auto-save (a lost tweak is always recoverable by editing again).
_Avoid_: Save on blur (names the mechanism, not the rule), draft, autosave-everything
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
- **Mission Control** renders its pitches as a **Pitch timeline** — per-pitch **Timebox** bars grouped by squad on the **Cycle window**'s shared scale; derived, never stored

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
- **"Linear-quality" / "lean toward Linear"** — means Linear's **interaction feel** (type-ahead pickers, keyboard fluency, optimistic/instant, quiet density), **not** its **data model**. Task statuses/workflow, priority, labels, sub-issues, estimates, and due dates stay out — they reintroduce the issue-tracker this tool defines itself against (tasks are binary; progress is the **Needle** + **Hill Chart**, not a task tally — ADR 0007). The door to *some* model borrowing is deliberately left ajar for later (like discipline tags), but as of now the rule is **feel yes, ontology no**. Within "feel", full **keyboard row-navigation** (single-key shortcuts, roving focus across task rows) is also deferred — v1's keyboard fluency comes for free inside the type-ahead assignee picker, not from a drawer-wide hotkey layer.
- **"active" for tasks** — a not-done task is **Open**, never "active". "Active/inactive" is already reserved-against for **Cycle phase**, and "status" is a known landmine; the Scope Drawer's task filter toggle is labelled **All / Open**, not "All / Active".
- **`BE/Simon`-style task prefixes** encoded two orthogonal things in the title: a **discipline** (`BE`/`FE`/design) and an **assignee** (`Simon`). Resolved (v1): only the **assignee** half becomes a first-class field (a Clerk org user on the **Task**). The discipline half — a task **type/tag** — stays deferred; the glossary's "no type" stance still holds for now. Revisit tags only if the prefix hack persists after assignment ships.
