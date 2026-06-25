# ADR 0013: Timebox & cycle-window math counts business days, anchored to one team timezone

## Status

Accepted — **amended 2026-06-25** (see "Correction: `end` is inclusive" below).

## Context

`computeTimebox(start, end, today)` and `dayTicks` in `src/lib/timebox-engine.ts`
are a single pure engine shared by two domain concepts (ADR 0010): a pitch's
**Timebox** and the **Cycle window**. Until now every quantity it produced —
`totalDays`, `daysLeft`, `dayNumber`, `fractionElapsed`, `currentWeek` /
`totalWeeks`, and the tape ticks — counted raw **calendar days** (`/7` for
weeks). It also depended on `today`, derived at two call sites
(`mission-control.tsx`, `scope-map.tsx`) as the **UTC** date
(`new Date().toISOString().slice(0, 10)`).

Two problems for a Shape Up tool whose cadence is working time:

1. **Calendar days overstate runway.** "12 days left" includes weekends nobody
   works. A working-day countdown is what teams actually reason about.
2. **UTC is the wrong clock.** The team works in Montreal; one developer is in
   France. During EDT, UTC midnight is 8pm Montreal, so the app rolled to
   "tomorrow" every evening — and under business-day math that means a Friday
   countdown would freeze for the weekend a full evening early and un-freeze
   Sunday evening.

## Decision

**1. Count business days everywhere.** The whole engine switches to Monday–Friday
units — not just the "days left" label. A mixed model (calendar-spaced tape, but
business-day countdown) would desync the today marker from the label, so it is
all-or-nothing.

- `totalDays` = business days in the half-open span `[start, end)`;
  `elapsed` = business days in `[start, today)`; `dayNumber = elapsed + 1`.
  *(Superseded — `end` is now inclusive; see the 2026-06-25 correction below.)*
- Weekends contribute zero. A weekend `start`/`end` simply adds no day, and a
  weekend "today" holds the marker flat at the prior Friday's position — the
  countdown does **not** tick across the weekend.
- **One week = 5 business days.** `totalWeeks = ceil(businessDays / 5)`,
  `currentWeek = floor(elapsedBusinessDays / 5) + 1`. A 6-week build cycle is
  30 business days → "Week 6 of 6"; a 2-week cooldown is 10 → "Week 2 of 2". A
  ragged span rounds its final partial week up.
- Tape draws one tick per business day, **major tick every 5th** (was 7th) to
  mark week boundaries.
- **No holiday calendar.** Weekends only. Holidays are absorbed into the team's
  reality, not re-counted — and avoiding them keeps the engine a pure function
  of `(start, end, today)` with no external calendar dependency.

**2. Anchor "today" to a single team timezone.** A new constant
`TEAM_TIMEZONE = 'America/Montreal'` is used at every `today` derivation site
(via `Intl.DateTimeFormat` with `timeZone`, so DST is automatic). "Days left" is
a property of the **cycle**, not the viewer — it freezes into shared snapshots
and posts to a shared Slack channel — so it must be the same number for everyone.
The France-based developer reads Montreal's "today"; we deliberately do **not**
compute per-user, which would desync the shared countdown and make a frozen
snapshot's value ambiguous.

**3. Frozen history is left untouched.** `timebox_snapshot` values written before
this change keep their calendar-day numbers (consistent with ADR 0005/0006:
snapshots are computed once and never recomputed). The one-time discontinuity in
old cards is cosmetic and washes out within a cycle.

## Consequences

- The engine stays pure; only its unit changes, plus the two `today` call sites
  now pass a Montreal-anchored date instead of a UTC one.
- A pitch card shows the **same** "N days left" all weekend — correct for a
  working-day countdown, but a reader expecting a daily tick should know it is
  intentional.
- Cycle start/end dates are expected to span whole business weeks
  (e.g. Monday → Friday) for clean "Week X of Y"; ragged spans round up.
- A span that falls entirely on a weekend yields 0 business days and lands in the
  existing `totalDays <= 0` guard (the "before"/empty state).
- **Known limitation:** the team timezone is hardcoded. If we ever onboard an org
  in a different region, this becomes per-org configuration (defaulting to
  Montreal) — revisit here. Per-*user* timezone is explicitly rejected, not
  deferred.

## Correction: `end` is inclusive (2026-06-25)

The original decision made `totalDays` the business days in the **half-open**
span `[start, end)`, excluding `end`. That was wrong for a human-facing date
field: everywhere a person touches `end_date` it means **the last working day**
("the cycle ends Friday Aug 28" includes Friday). The create form stores the
picked date as-is, and the tape displays it as-is — so a Friday end dropped
Friday, the final week rendered 4 ticks instead of 5, and on the last day the
window read "complete" with 0 days left.

**`end` (and a pitch timebox's `timebox_end`) is now inclusive — the last
working day.** `computeTimebox` derives the exclusive boundary it needs by
adding one calendar day (`endExclusive = end + 1d`) and feeds that to the
unchanged half-open `businessDaysBetween`. The `today >= end` "after" guard
becomes `today >= endExclusive`, so the last working day counts as active.

Note the deliberate asymmetry: **`totalDays` counts `[start, end]` inclusive,
but `elapsed` stays `[start, today)` exclusive** — "today" is the day in
progress (day N), not a day already spent, so `dayNumber = elapsed + 1`. A
Mon→Fri 6-week build is now 30 business days with the final Friday counted, and
the tape closes week 6 with a major tick.
