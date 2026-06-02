# Scope cards show task presence, not task completion

Scope cards are big-picture tiles: their job is to communicate **what a scope is** (name) and **what it ships** (litmus), not how "done" it is. When a scope has tasks, the card shows a non-numeric **presence indicator** (one tick per task, filling as tasks complete) — never an `X/Y done` count or a completion progress bar. Task management itself moves off the card into a right-side **scope drawer** opened by clicking the card body.

## Status

accepted

## Context

The old card carried an inline task list and an `X/Y done` footer. That reintroduced exactly the "% complete" framing the tool is designed to reject: real progress is meant to be read from the **needle** (subjective impression) and the **hill chart** (figured-out-ness), per [CONTEXT.md](../../CONTEXT.md). **Tasks** are deliberately binary with no intermediate states, and **Hill Progress** explicitly avoids "completion percentage / progress bar." A literal task-completion bar on the card would contradict all three.

## Considered options

- **`X/Y done` count or a completion progress bar** — rejected. It asserts "this scope is N% finished" from a checkbox tally, smuggling estimate-driven progress back in and competing with the needle/hill chart as the progress signal.
- **No task signal on the card at all** — rejected. The card would give no hint that a checklist exists, hurting discoverability of the drawer.
- **Non-numeric presence indicator (chosen)** — signals "there is a checklist here, and roughly how full it is" as an affordance to open the drawer, without making a completion claim. It is glanceable, not measured.

## Consequences

- The card face is **name (hero) + `what it ships:` litmus + presence indicator**, at a uniform fixed height regardless of task count.
- Task add/toggle/edit/delete/reset and scope field editing (name, tier, litmus) all live in the **scope drawer**; the drawer is the single editor and uses inline auto-save (Enter/blur saves), matching the existing task-row pattern and the real-time Liveblocks model.
- The `⋯` menu drops **Edit** (clicking the card opens the editor) and keeps **Delete**.
