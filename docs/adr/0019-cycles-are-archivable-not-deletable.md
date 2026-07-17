# ADR 0019: Cycles are archivable (reversible), never deletable

## Status

Accepted — revisits [ADR 0015](0015-cycle-lifecycle-is-date-derived.md).

## Context

A cycle is a Liveblocks room holding everything created within it — pitches,
scopes, tasks, updates, squads. There is deliberately **no `delete_cycle`** and
no delete UI: removing a cycle would take all of that with it, irreversibly.

But cycles do get created by mistake (wrong dates, a test room, a fat-fingered
duplicate), and today there is no way to get rid of one. A bogus cycle sits in
the Cycles list forever, and — worse — a mistaken "current" cycle can hijack the
default landing (ADR 0015).

ADR 0015 rejected a stored `archived` flag because, for *lifecycle*, the dates
already say everything: a stored active/archived state would duplicate and drift
from the date-derived phase. But it explicitly left the door open: "If a real
need to hide a cycle independent of its dates emerges, that is a new capability —
layer an explicit override on top and revisit this ADR." That need has arrived.

## Decision

**A cycle can be archived and unarchived. It can never be permanently deleted.**

- **Archive is an explicit, reversible, stored override**, orthogonal to the
  date-derived **Cycle phase**. Any cycle can be archived regardless of whether
  it is upcoming/current/past; unarchiving returns it to its date-derived group
  unchanged. This does **not** contradict ADR 0015's "phase is never stored" —
  phase stays date-derived; `archived` is a separate axis layered on top, which
  is exactly the "explicit override" 0015 anticipated.
- **Storage:** `archived` is mirrored into **both** the storage `cycle`
  LiveObject and the room metadata, via the existing `updateCycle` writer — the
  same two-places-kept-in-sync invariant as every other cycle field (ADR
  0015/0011). Metadata is string-valued, so archived is `'true'` / absent. The
  list, landing, and stepper read metadata only (no room open); the in-cycle
  banner reads the storage object reactively.
- **Archived cycles vanish from every derived-navigation surface:** excluded
  from `groupCycles`' phase buckets (checked before phase, into their own
  `archived` bucket), from `resolveLanding`, and from `cycleNeighbors` (the
  stepper). Their underlying `cyclePhase` is untouched.
- **Access is never blocked.** A direct URL to an archived cycle still opens
  normally; the page shows a banner ("This cycle is archived") with an inline
  Unarchive action. Archive affects listing/landing/stepper, not reachability.
- **Surfaces:** archive from the cycle's "…" menu and from each Cycles-list
  row's "…" menu; unarchive from the collapsed **Archived** list section, from
  each archived row's "…" menu, and from the in-cycle banner. A light confirm
  guards archive (it changes what every collaborator sees) but uses no
  destructive-red styling, because it is reversible.
- **MCP:** dedicated `archive_cycle` / `unarchive_cycle` tools (mirroring the
  `delete_*` family shape for discoverability), routed through `updateCycle`.
  Reversible, so **not** added to the batch tool's `DESTRUCTIVE_TOOLS` set.

## Consequences

- ADR 0015 stands: cycle *phase* remains purely date-derived. This adds a second,
  orthogonal axis (`archived`) — it does not retrofit the date derivation.
- The "keep the slate clean" principle is preserved: archive hides mistakes, it
  is not a backdoor to a backlog. Archived cycles are still fully real and
  reachable, just out of the way.
- No data is ever destroyed. The cost is that truly-junk cycles accumulate in the
  Archived section forever; if hard-delete is ever genuinely wanted, that is a
  further capability and another ADR — do not add it by weakening this one.
- `archived` joins the set of fields the storage↔metadata mirror must keep in
  sync; the single `updateCycle` writer remains the only place that writes it.
