# Tasks carry a single assignee

A **Task** was deliberately dumb — "no assignee, no type, no intermediate states" — so progress reads from the needle and hill chart, never a checkbox tally. Devs adopted tasks heavily and started faking ownership with `BE/Simon`-style title prefixes, so we promoted **assignment** to a first-class field: a single, nullable `assigneeId` (a Clerk org user) on each task. Tasks stay binary; we added *who*, not state or type.

## Status

accepted

## Considered options

- **Scope-level owner instead of task-level** — rejected. A scope is a vertical slice spanning BE/FE/design; the `BE/Simon` prefix is per-task, so ownership belongs on the task.
- **Multiple assignees per task** — rejected. "Who's doing this?" should have one answer; genuinely split work is two tasks. Keeps the field a single nullable pointer, mirroring the **Core Scope** pointer.
- **Discipline tags (`FE`/`BE`/design) in the same release** — deferred. `BE/Simon` encodes two orthogonal things; only the assignee half ships now. The "no type" stance still holds until the prefix hack proves it needs killing.
- **Snapshotting assignees into Updates** — rejected. The weekly narrative is about how the pitch is going, not who holds which checkbox. Assignment stays purely live, out of Updates and Slack.

## Consequences

- **Dangling assignee = Former member.** A dangling `assigneeId` (person left the org / cycle reopened) resolves to an *anonymous* greyed ghost — never an "Unknown user" with a fabricated name. We can't tell account-deactivation from org-removal, so the honest meaning is "no longer a member of this org." No per-task name snapshot is stored; avatars resolve live. Mirrors the dangling `core_scope_id` pattern.
- **People on the Scope Card, within ADR 0007.** The card gains a deduped assignee cluster (distinct faces across the scope's tasks, capped). ADR 0007 forbids a *completion* claim; an identity signal (who's on it) is orthogonal and allowed. This clarifies — does not overturn — ADR 0007.
- **Long task text wraps** in the drawer read view (the `truncate` that hid sentence ends is dropped); the edit affordance becomes a textarea. Card titles are unaffected (the card shows presence ticks, not titles).
- **MCP assignment is deferred (reader-only).** `assigneeId` is exposed in MCP reads, but `upsert_task` does not set it in v1 — agents don't hold Clerk `userId`s, and resolving a name would put a Clerk dependency in the pure-Liveblocks write path. The writer is already partial (ADR 0011), so existing MCP task calls leave `assigneeId` untouched. When added later: `assignee?: string` (name/email), `''` = unassign, omit = unchanged.
