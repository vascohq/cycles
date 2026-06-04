# ADR 0011: MCP upsert tools are partial updates — optional fields, never defaults

## Status

Accepted

## Context

A production incident nullified every pitch's **Timebox**: `timebox_start` and
`timebox_end` were wiped to `''` across a cycle. The trigger was routine — a
user assigning **Squads** to existing pitches via the MCP `upsert_pitch` tool,
passing `id`, `title`, `stage`, `squad` and omitting the timebox fields.

The MCP upsert tools (`upsert_pitch`, `upsert_scope`, `upsert_task`,
`upsert_parking_item`) behave as **full-overwrite updates**, but their schemas
declared the non-identity fields with Zod `.default(...)`:

```ts
timebox_start: z.string().default(''),   // upsert_pitch
hill_progress: z.number().min(0).max(1).default(0),  // upsert_scope
done: z.boolean().default(false),        // upsert_task
```

When a caller omits such a field, Zod fills it with the default, and the writer
then unconditionally `existing.set('timebox_start', '')` — silently destroying
the real value. `computeTimebox('', '', today)` returns all zeros, which renders
as "no timebox". The same shape would reset `hill_progress` to the bottom of the
hill on a title-only scope edit, or un-complete a task.

Only the `squad` field had been built correctly (added later, in the squad work):
`z.optional()` plus a writer guard, with documented "omit = leave unchanged"
semantics. The older fields predated that awareness.

## Decision

MCP upsert tools have **partial-update semantics**: a field the caller omits is
**left unchanged** on update. To honour that, every non-identity field is fixed
at two layers:

1. **Schema** — declare it `z.optional()`, never `z.…().default(…)`. A default
   coerces "omitted" into a concrete value, which is indistinguishable from an
   intentional overwrite by the time it reaches the writer.
2. **Writer** — in the update branch, guard each set:
   `if (params.x !== undefined) existing.set('x', params.x)`. On the create
   branch, supply the fallback there (`params.x ?? ''`). Do **not** rely on
   Liveblocks treating `set(key, undefined)` as a no-op — guard explicitly so the
   contract is visible at the call site and matches the `squad` handling.

Identity fields that the tool genuinely requires (`title`, `stage`, `tier`,
`text`, parent ids) stay required and may be set unconditionally — the MCP call
errors if they're missing, so they can't be silently defaulted.

The tool descriptions state the partial-update contract explicitly so the
calling agent knows omission preserves rather than clears.

## Consequences

- New upsert fields must follow the pattern. When adding one, ask: "should
  omitting this wipe it?" If no, it's `z.optional()` + writer guard + a
  create-time fallback.
- Two regression seams lock this down (see `src/lib/mcp/*.test.ts`):
  - **Schema seam** — parse the *registered* Zod schema with the field omitted
    and assert it stays `undefined`, not the old default. This is the true
    root-cause seam; handler-level tests can't catch it because they mock the
    writer and run with already-parsed params.
  - **Writer seam** — a "leaves X untouched when omitted" test per upsert tool.
- Clearing a field is now an **explicit** act: pass `''` (or `false`) on
  purpose. Omission never clears.
- The fix shipped in #111; this ADR records the convention so it isn't
  re-broken when the next field is added.
