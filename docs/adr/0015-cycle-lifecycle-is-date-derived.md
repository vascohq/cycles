# ADR 0015: Cycle lifecycle is date-derived; landing resolves to the current cycle

## Status

Accepted — amended by [ADR 0019](0019-cycles-are-archivable-not-deletable.md),
which adds the explicit `archived` override this ADR anticipated. Phase stays
date-derived; archive is a separate, orthogonal axis.

## Context

A cycle has always carried `start_date` and `end_date`, and ADR 0010 introduced
the **cycle window** — the cycle's own span, rendered through the same
`computeTimebox` engine as a pitch timebox, which already reports a phase of
`before` / `during` / `after`.

Three needs surfaced together:

1. Teams want to **rename a cycle and fix its dates** from the UI (today only
   the MCP `update_cycle` tool can, via `liveblocks-writer.ts`).
2. Teams want **past cycles to recede** — the Cycles list is a flat, undated
   `<ul>` where a finished cycle looks identical to a live one. The word
   "archive" came up.
3. The Cycles list is the default landing and feels underwhelming — landing
   straight in the live cycle would feel better.

The tempting move for (2) was a stored `archived` flag (or an `active` /
`status` enum) that a human toggles. But a cycle is, by definition, a fixed
time box: when its end date passes, it is over. A stored "active/archived"
state would duplicate what the dates already say, drift out of sync with them,
and add a verb ("archive") that the glossary deliberately avoids — sitting
alongside the rejected "backlog" and "buffer". It also invites a back door
around the core principle of keeping the slate clean.

## Decision

**A cycle's lifecycle phase is derived purely from its dates, never stored.**

- **Cycle phase** (`upcoming` / `current` / `past`) is computed from
  `[start_date, end_date]` against the Montreal "team today" (per ADR 0013) —
  the same `before` / `during` / `after` the cycle window already produces. So
  the phase is the same for everyone, including remote teammates.
- There is **no `archived` field and no archive action**. "Archiving" is only a
  _visual_ treatment: in the Cycles list, past cycles fold into a collapsed
  disclosure and dim. Folding is presentation, not state.
- **Editing** a cycle (name, type, dates, Slack channel) reuses the existing
  `updateCycle` writer, which mirrors the storage `cycle` LiveObject and the
  room metadata. The slug is **not** editable — it is the room ID
  (`{orgPrefix}:cycle:{slug}`), baked into every URL and the MCP slug path;
  changing it would mean recreating the room.
- **Default landing resolves to the current cycle.** `/` and `/{slug}` redirect
  to `/{slug}/cycles/{currentCycleSlug}` when a current cycle exists (latest
  start date wins if spans overlap). When none is current, landing falls back
  to the Cycles list. The list page itself (`/{slug}/cycles`) never
  auto-redirects, so it stays reachable.

## Consequences

- No lifecycle field to keep in sync; the dates are the single source of truth.
  Correcting a cycle's dates instantly reclassifies it — no second toggle to
  remember.
- A botched or experimental cycle cannot be manually hidden. If a real need to
  hide a cycle independent of its dates emerges, that is a new capability —
  layer an explicit override on top and revisit this ADR; do not retrofit the
  date derivation.
- The root redirect must read room metadata (dates) and compute phase
  server-side before redirecting — a cheap metadata scan, no storage reads.
- "Current" can be ambiguous if cycles overlap in time. We resolve it
  deterministically (latest start), but overlapping cycles remain possible —
  nothing enforces non-overlap.
- The Cycles list now sorts by `start_date` (not creation time) and groups by
  phase, with an "Undated" catch-all for cycles created without dates (the MCP
  `create_cycle` permits empty dates).
