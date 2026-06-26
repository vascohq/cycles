# Kanban is a view over a pitch's tasks, not a separate entity

Some work — cooldown fixes, third-party-bound or repetitive flow (Vasco's "Kanban" operating mode) — wants a board of cards in columns, not a hill and a needle. Rather than add a second top-level entity, **Kanban is a stored, switchable `view` on the existing `CyclePitch`** (`view: 'scope_map' | 'kanban'`). The same pitch, the same tasks, rendered two ways. A pitch built in `kanban` view simply never accrues scopes or a needle; nothing else changes. This keeps every pitch inside one **Cycle** room and dies with it on **clean slate**.

To make tasks board-able, the **Task** model changes: it gains a `pitchId` and a fixed `status: 'todo' | 'doing' | 'done'`, and `scopeId` becomes **optional**. A task with no `scopeId` is an **Unscoped task** — the "awaiting triage" card.

## Status

accepted

## Considered options

- **A separate, cross-cycle Kanban entity** (matching Vasco's Kanban methodology doc, where Kanban "flows continuously across cycle boundaries") — rejected. The whole app is one Liveblocks room per cycle (ADR 0002), and clean-slate is a core principle. A continuous board has no home here and would fork the data model. We deliberately diverge from the doc: here Kanban is cycle-bound.
- **A `mode` flag that swaps the pitch's whole nature** (kanban pitches *cannot* have scopes/needle) — rejected in favour of a pure `view` toggle. Because a board just groups tasks by `status` and the scope map groups them by `scope`, the toggle is non-destructive: switching creates/deletes/moves nothing. Needle, hill, and scopes are data that may or may not exist, independent of the view.
- **Scopes as swimlanes** (scope-rows × status-columns grid) — deferred. v1 renders scope as a **colored tag** on the card (reusing **Scope Color**); cards from all scopes intermix within a column. The grid layout is a larger, separate build.
- **An embedded kanban section inside the Scope Map** (e.g. a QA board below the scopes) — rejected. The whole-pitch view toggle serves the same need without maintaining a second layout; flip the pitch to Kanban view and tag cards by scope.
- **Keeping `scopeId` required, with one hidden implicit scope per kanban pitch** — rejected once "report a task awaiting triage" surfaced as a real need. Unscoped tasks are a genuine concept, not plumbing, so `scopeId` is honestly optional.

## Mode vs view

Two distinct ways a pitch is Kanban, settled after the first build:

- **Kanban mode** is **derived from the timebox** (= appetite): no timebox ⇒ board-only, with no needle/hill/scope-map and **no view switcher**. This is the pure kanban pitch — flow work with no fixed clock. Not a stored flag; it falls out of `hasTimebox`, so it needs no new field and no creation-time choice.
- **Kanban view** is the stored `view` toggle (`scope_map` | `kanban`) — but it only applies to **Shape-Up pitches** (those *with* a timebox), letting them *also* be shown as a board. The switcher renders only there. Crucially, the view **keeps the needle/hill** — it only swaps the surface *below* them (scope grid ↔ board). Hiding the needle/hill is a property of *mode*, not *view*.

So the needle/hill section renders when `hasTimebox`; the board renders when `showKanban = !hasTimebox || view === 'kanban'`; the scope grid when `!showKanban`. Trade-off accepted: a Shape-Up pitch that hasn't been given a timebox yet reads as Kanban mode until dates are set — benign, and consistent with "no appetite ⇒ not yet shaped."

## Consequences

- **Schema change to Task.** `pitchId` added (always set), `scopeId` optional, `status` enum added. Legacy binary `done` is **derived** (`status === 'done'`) so existing done-counts and snapshots keep working. `doing` exists only as a board column — the Scope Drawer still renders a task as a plain done/not-done line.
- **Unscoped tasks need a home in Scope Map view.** They surface in a self-hiding **Triage tray** (hidden when empty), each with an "assign to a scope" affordance. This is the deliberate edge of **No Backlog, No Noise**: it appears only while there's untriaged work. No size cap in v1.
- **Kanban pitches ship manually.** No needle means the needle-at-100% auto-advance can't fire; a kanban pitch defaults to `building` and is flipped to `done` manually (optional — clean-slate auto-ends it at cycle close). Framing/shaping stages don't apply.
- **Celebrations reuse existing confetti.** `fireTaskDoneConfetti` fires per card into the Done column; `startConfettiRain(gold = true)` is the all-cards-done gold parade — a celebration, **not** a stage change.
- **Kanban-mode pitches have no Updates.** An Update is a needle move over a timebox; a Kanban-mode pitch (no timebox) has neither, and the board itself is the status — so the Updates feed and posting are hidden when `!hasTimebox`. (An earlier plan for a card-diff "Kanban update" was dropped in favour of this simpler rule. A Shape-Up pitch *viewed* as Kanban keeps its needle and Updates.)
- **MCP follow-ons.** `upsert_pitch` gains an optional `view` param; `upsert_task` gains optional `status` and pitch-level (scopeless) creation; `move_task` extends to move a card between statuses. All partial-update-safe (ADR 0011).
- **Mission Control row.** A kanban-view pitch has no mini-needle; its row shows a `kanban` badge in that slot plus its **Timebox** bar if one is set.
- **Deferred:** swimlanes, WIP limits, embedded sections, counting unscoped tasks in `task_snapshot`, per-viewer view override, a Triage-tray size cap.
