# ADR 0025: A frame's Type selects its playbook; its lifecycle is derived

## Status

Accepted.

## Context

A **Frame** carries a **Kind** (`brand_burn`, `pain_point`, `unlock_win`), which is Ryan Singer's severity axis and the axis with a color on the map.

That axis does not answer a different question the team asks constantly: is this a bug, an idea, a request, a security problem, or an irritant? A design session settled that answer already. The type of an item decides which workflow applies. A bug skips full shaping. A feature runs Shape Up or Kanban. A security problem wants one pull request per service.

The team also described a frame living past its bet: capture, build, release, then monitoring for quality problems or adoption problems.

## Decision

**A frame carries a Type, and Type selects the Playbook.** Type is `bug`, `idea`, `request`, `security`, or `irritant`. It is routing, not decoration.

**Type gets no visual channel.** A **Pin** already carries four channels, which is the legibility ceiling. Type appears in the frame detail and in `map_list_frames` filters.

**A playbook names the Pointers its frames expect.** The expected set minus the frame's own pointers is the frame's **Gap list**, derived and never stored. **A gap blocks nothing.** It is a prompt, not a gate.

**A frame's state is derived from what it points at, never stored:**

`rough` (no appetite) → `candidate` (sharp, no **Shape** yet) → `in_flight` (a Shape that is not `done`) → `released` (its Shape reached `done`) → `monitoring` (released and not resolved) → `resolved` (a person resolved it).

**A problem found during monitoring becomes a new frame**, with an **Origin frame** pointer back to the frame whose monitoring surfaced it. It never reopens the old frame.

## Considered options

- **One axis, stretching Kind to cover both questions.** Rejected. Severity and origin are different questions, and mixing them makes the map's color meaningless.
- **Type as a filter only, with no playbook link.** Rejected. It throws away the one thing Type buys beyond search.
- **Give Type a shape or a glyph on the pin.** Rejected. Five channels on one dot is unreadable.
- **Enforce the gap list, blocking a frame while a pointer is missing.** Rejected. That is a gate somebody has to satisfy, which is the issue tracker this tool defines itself against.
- **Reopen the original frame when monitoring finds a problem.** Rejected. A quality problem after release has its own problem, appetite and business case. One frame text cannot hold two differently-framed problems, which ADR 0022 already refuses.
- **A stored lifecycle state.** Rejected. Every state is already visible from the frame's pointers and its shape's stage, and a stored state would drift.
- **Live adoption and quality metrics on the frame.** Rejected for scope. It needs an event source, a metric per frame and a threshold per metric. An agent watching a dashboard can call `map_upsert_frame` like any other capturer.

## Consequences

- Type is required at capture. The capture skill asks for it, and an agent supplies it. There is no "unknown" type, because Type decides the workflow.
- Adding a playbook means adding a Type. The two vocabularies stay in step, so a new Type with no playbook is a bug.
- `map_list_frames` filters by Type. This is what answers "what bugs could I take" without a browsable list.
- The origin pointer gives a visible chain of which releases create follow-on pain. Nobody has to maintain it, because it is set once at capture.
- Live metrics are the obvious next pitch, not part of this one.
