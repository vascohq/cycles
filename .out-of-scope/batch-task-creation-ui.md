# Batch Task Creation in the UI

Cycles does not add a batch/multi-line task-creation flow to the in-app scope
drawer. Adding tasks by hand stays one-at-a-time; creating many tasks at once
is a job for the MCP `batch` tool.

## Why this is out of scope

Batch writes already exist — programmatically. The MCP `batch` tool
(`src/lib/mcp/tools.ts`) takes an `operations` array and runs them
sequentially via `handleBatch`, so any number of `upsert_task` ops create any
number of tasks in a single call:

```jsonc
{
  "tool": "batch",
  "operations": [
    { "tool": "upsert_task", "params": { "scopeId": "s1", "title": "First"  } },
    { "tool": "upsert_task", "params": { "scopeId": "s1", "title": "Second" } }
  ]
}
```

Cycles is built agent-first — no dev seeding, MCP write tools, agent briefs.
Bulk task entry is expected to happen through an agent driving MCP, which the
`batch` tool already covers. A bespoke multi-line textarea in the drawer is
speculative convenience UI for a workflow the team doesn't actually use by
hand; the in-app control deliberately stays single-task to keep the drawer
simple. If humans start hitting the manual-entry wall in practice, reopen with
evidence and this decision can be revisited.

## Prior requests

- #184 — "Batch task creation in the UI (multiple tasks at once)" (from the
  All-Squad retro 2026-07-16). Initially mis-scoped as needing a UI feature;
  the underlying ask was batch creation, which MCP already provides.
