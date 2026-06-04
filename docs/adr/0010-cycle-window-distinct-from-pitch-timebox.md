# ADR 0010: "Cycle window" is distinct from a pitch's "Timebox"

## Status

Accepted

## Context

A cycle has always carried `start_date` and `end_date` (see `Cycle` in
`src/cycle-liveblocks.config.ts`), but nothing surfaced "where are we in the
cycle?" on Mission Control. We wanted to show that — the cycle behaves like a
timebox itself, with a start, an end, and a today marker.

The tempting move was to call the cycle's span a "Timebox" and be done. But
`CONTEXT.md` already defines **Timebox** narrowly as _"the fixed time boundary
of a **pitch**"_ — visualized as the tape-measure strip, fed into needle
update snapshots (`timebox_snapshot`), and reasoned about per-pitch throughout
the codebase. Overloading "Timebox" to also mean the cycle's span would blur a
term that currently has one precise referent.

## Decision

Keep **Timebox** reserved for pitches. Name the cycle's span **Cycle window**.

- The two concepts share the _visual_ vocabulary — both render through the
  `TimeboxTape` component and the pure `computeTimebox` engine — but they are
  named distinctly so the glossary keeps one term, one referent.
- On Mission Control the cycle window appears as a header strip: the
  tape-measure plus an explicit **Week X of Y** label, because cycle cadence is
  week-oriented (build = 6 weeks, cooldown = 2).
- The cycle window is **display-only** here. Its dates are set at cycle
  creation (`create-cycle-form.tsx`); Mission Control reads them, it does not
  edit them.

## Consequences

- `TimeboxTape` / `computeTimebox` are now shared by two domain concepts. They
  stay purely mechanical (start, end, today → fractions/weeks) and carry no
  pitch-specific or cycle-specific meaning, which is what makes the reuse safe.
- A reader who sees "Week 3 of 6" on Mission Control and "12 days left" on a
  pitch card should understand these as two different timeboxes-of-meaning: the
  cycle window vs. a pitch timebox.
- If we later let teams edit the cycle window in place, or snapshot it into
  updates the way pitch timeboxes are, that extends this concept — revisit here.
