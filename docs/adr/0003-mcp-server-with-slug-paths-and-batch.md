# MCP server with slug-path addressing and batch operations

The MCP server uses slug paths (e.g. `2026-q2-build/agentic-capabilities/make-a-skill`) to address entities instead of opaque IDs. This lets Claude create and reference entities by name without discovery calls. Combined with a batch operation tool, an entire Notion pitch can be ingested in two MCP calls: one `get` to see what exists, one `batch` to create/update everything.

We considered ID-only addressing (stable but requires discovery round-trips) and name-based upsert matching (intuitive but fragile across renames). Slug paths give human-readable addressing without magic matching — the slug is derived from the name at creation time and stays stable.

The create-vs-update semantic is explicit: no ID means create (returns the new ID), ID present means update (404 if not found). No implicit upsert matching.

## Consequences

- Entities need slugs: cycles and pitches are slugged from their name. Scopes, tasks, and parking items are addressed by parent slug path + their own ID.
- The batch tool accepts an array of operations, executes them sequentially, and returns all results. Partial failures return the error alongside successful results.
- **`batch` bypasses the tool layer, so pre-writer work cannot live there.** A batched op's params go straight from the client to the writer (`batch` types them as an open record), so any normalization a tool handler does on its own — resolving an `assignee` email to a Clerk userId, normalizing an emoji, validating a Notion URL — is silently skipped on the batch path. `assignee` showed how bad that is: the writer takes `assigneeId`, so an unresolved `assignee` isn't an error there, it's an *omitted field* — the op reports `ok: true` having assigned nobody, and a 13-card batch looks like it worked. That normalization is therefore a named step (`prepareWriteParams`) both entry points call, and it runs **before** `openBatch` — resolving an assignee hits Clerk, which must not happen while a `mutateStorage` is held open. A ref that resolves to nobody fails **that op only**, like any other batched failure. (Validation the writer can do without external lookups still belongs in the writer, which is the one door every path passes through — see ADR 0018 on card status.)
- Auth uses Clerk OAuth with Dynamic Client Registration (DCR), scoped per org.
