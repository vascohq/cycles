# ADR 0014: Calendar overlays are external reference data — fetched server-side, never stored in Liveblocks

## Status

Accepted

## Context

We want to surface **Holidays** (statutory days from per-region calendar feeds, e.g.
Canada and France) and **Time Off** (individual vacations from a Humi `.ics`
feed) on the **Cycle window** so a team can see, at a glance, which days are off
during a cycle.

This is a new kind of data for the app. [ADR 0001](0001-all-data-in-liveblocks.md)
establishes that *all cycle data lives in Liveblocks* — there is no database and
no server-side ingestion. But calendar feeds are **external, read-only,
non-collaborative reference data**: not authored by users, not edited in the
room, and changing on the calendar provider's schedule, not ours. They don't fit
the collaborative store the way pitches and scopes do.

Cycles is open source and multi-org, so the feed set cannot be hardcoded Vasco
literals, and there is no DB to hold per-org config. The Humi URL is a
*capability URL* (its `token=` is the secret); the Slack webhook (today an env
var, `SLACK_WEBHOOK_URL`) has the same per-deployment, all-orgs-share-one
limitation.

## Decision

1. **Overlay only — never recompute.** Holidays and Time Off are purely FYI
   bands drawn on the Cycle window. `computeTimebox` is left untouched: no
   working-day math, no capacity, no "adjusted end date." This matches the
   product's manual-by-design stance (the Needle is never calculated; the
   Timebox is dumb calendar days).

2. **Fetched server-side, not stored in Liveblocks** (deviation from ADR 0001).
   A server component reads the org's feed list, fetches and parses the `.ics`
   feeds (`node-ical`, expanding `RRULE`), and passes the resulting date bands to
   the client via the page boundary — the same pattern CLAUDE.md prescribes for
   server-only values. Liveblocks stays the source of truth for *cycle work*;
   calendars are treated as what they are — external reference.

3. **Per-org config in Clerk `organization.privateMetadata`, one settings page.**
   The only per-org store we have without adding infrastructure is Clerk org
   metadata. A small feed list `[{ kind: 'holiday'|'timeoff', label, url }]` plus
   the **Slack webhook URL** live in `privateMetadata` (server-only — capability
   URLs and the webhook never reach the browser). A single org-admin-only
   "integrations" settings page manages them. The Slack webhook migrating off the
   env var into this model is a sibling slice on the same shared page.

4. **Whole-day bands, in the event's own timezone.** Every event is reduced to
   the set of whole calendar dates it covers (the app runs on bare `YYYY-MM-DD`
   strings). Time-of-day is ignored — half-days render as full days. Two visual
   layers: Holiday (full-height tint, named on hover, labeled by region) vs Time
   Off (thinner band, named from the event `SUMMARY`, aggregated when several
   overlap).

5. **Fail soft.** A feed that fails to fetch or parse contributes no bands; the
   Cycle window still renders and the error is logged server-side. A broken Humi
   token must never take down Mission Control.

## Consequences

- v1 is **cycle-window only**, with **no person model** and **no name
  reconciliation**: Time Off is the union of everyone's absences, and a
  region-specific Holiday (e.g. France) paints as if team-wide — the region
  label carries the nuance. Per-pitch / per-person attribution is deferred until
  Squads have rosters and feed names are reconciled to Clerk users.
- Feeds are cached with hourly `fetch` revalidation (holidays barely change;
  hourly is plenty for vacations).
- The Slack-config migration removes the `SLACK_WEBHOOK_URL` env dependency in
  favor of org metadata, so `slackEnabled` derives from "org has a webhook
  configured."
