# ADR 0016: Mission Control pitch list is a per-pitch timeline aligned to the cycle window

## Status

Accepted (supersedes earlier drafts: a per-squad "Squad span" envelope, then per-pitch bands drawn *on* the cycle window — both replaced after prototyping)

## Context

Mission Control originally listed pitches as a **card grid** grouped by squad.
We wanted a more efficient, scannable layout that also surfaced *when* in the
cycle each pitch's work sits.

This went through a prototype (the `prototype` skill: several variants behind
`?variant=`, switchable from a floating bar): current cards (A), a compact table
(B), a timeline/Gantt (C), and a stage kanban (D). Variant C won. Two earlier
designs were tried and dropped along the way — a per-squad envelope band, and
per-pitch bands rendered as an extra row *on* the cycle window — both lost to
"show each pitch as its own row on a shared timeline."

## Decision

1. **The pitch list IS a timeline.** Each pitch is a two-line row: a header
   (mini Needle, title, Stage badge) and its **Timebox** drawn as a bar. Pitches
   are grouped by squad in declared order, **Unassigned** last (the existing
   `groupBySquad` ordering, which also sorts each squad `building → shaping →
   framing → done`). The card grid is removed.

2. **One shared scale, aligned to the Cycle window.** Bars and the Cycle window
   tape share a single grid (`TIMELINE_GRID`) and both position with
   `businessDaysBetween` over `[cycleStart, cycleEnd]` (ADR 0013). The Cycle
   window strip renders in an *aligned* mode (label gutter + full-width tape) so
   one **today / "now"** line runs straight down the strip and every bar.

3. **Stage as a badge, not color/opacity.** Stage shows as an explicit pill
   (framing/shaping/building/done). A **done** pitch is struck through, dimmed,
   and sinks to the bottom of its squad. Bars are colored by **Squad Color**, not
   by stage or zone — squad is the grouping, the Needle owns sentiment.

4. **Timebox is optional.** A pitch with no timebox draws no bar (shows "no
   timebox") rather than rendering "Invalid Date"; the Scope Map and move-needle
   labels guard the same way. An explicit full-cycle timebox draws a full-width
   bar — no self-suppression.

5. **Derived, never stored.** The timeline is computed at render time from
   pitches + squads; rows link to each pitch's Scope Map. No new persisted
   fields, no MCP tool, no snapshot (mirrors ADR 0014's stance on derived data).

6. **Cycle stepper on the breadcrumb.** A prev/next cycle stepper sits on the
   breadcrumb row, ordered chronologically by start_date (`cycleNeighbors`),
   computed server-side from cheap room metadata.

## Consequences

- The Cycle window strip now always renders in aligned mode (the only consumer).
- The list is taller per pitch (two lines) than the old cards, traded for an
  honest at-a-glance read of *when* and *how far along* each pitch is.
- The prototype scaffolding (variants A/B/D, the `?variant=` switcher) and the
  abandoned pitch-band engine/component were deleted when C was promoted.
- A pitch with no timebox is a first-class case across the app (timeline, Scope
  Map tape, move-needle labels), per decision 4.
