# Core scope stored as a pitch pointer, set at the scope level

A pitch's **Core Scope** is stored as a single `core_scope_id` pointer on the `CyclePitch`, not as a `core: boolean` on each `CycleScope`. Yet the *only* way to set it is at the scope level — a Scope Drawer toggle, a clickable card star, and the MCP `upsert_scope { core }` field. The setter is on the scope; the truth lives on the pitch.

## Status

accepted

## Context

The **Core Scope** is the one scope that is the heart of a pitch — the slice built first to surface risk early. The defining invariant is **at most one core per pitch**. It is a third independent signal, orthogonal to **Tier** and build order (see [CONTEXT.md](../../CONTEXT.md)).

Two storage shapes were on the table:

- **`core: boolean` on each scope** — co-located with `tier`/`color`, symmetric with the other per-scope fields. But there is no database to enforce "exactly one true." Setting a new core is a two-write operation (flip the old off, flip the new on), and Liveblocks' concurrent edits open a window where two scopes are both core, requiring reconciliation. The invariant is a property of the *pitch* ("one heart"), so encoding it as a per-scope boolean misplaces it.
- **`core_scope_id` pointer on the pitch** — single pointer, so two cores are structurally impossible. Setting core is one write. This mirrors the existing `squadId` pointer (a pitch pointing at a sibling concept).

Independently, the product decision is that flagging is **scope-level**: users and agents think "*this scope* is the core" and act on the scope, never on the pitch directly.

## Decision

- **Store `core_scope_id?: string` on `CyclePitch`.** Unset (`undefined`/`''`) = no core. The invariant is unbreakable by construction; "is this scope core?" is `pitch.core_scope_id === scope.id`.
- **All setters are scope-level and write the pitch pointer.** The Scope Drawer toggle, the clickable card star, the empty-state banner picker, and MCP `upsert_scope { core }` all resolve to one write: `pitch.core_scope_id = scopeId`.
- **Single-select is silent steal.** Flagging scope B as core repoints the pitch from A to B with no confirm — there is one heart and moving it is a normal, reversible edit.
- **`upsert_scope { core }` follows ADR 0011 partial semantics:** `core` is `z.optional()`; `true` steals, `false` clears only if that scope is currently core, omit leaves it unchanged.
- **Dangling pointer = unset.** A `core_scope_id` referencing a missing scope reads as "no core" — the UI self-heals to the empty state. Deleting the core scope (UI + MCP `delete_scope`) clears the pointer in the same operation. The core is **never auto-promoted** to another scope — it is always a deliberate choice.

## Consequences

- The flag is not co-located with the scope, so code asking "is this core?" needs the pitch in hand. On the Scope Map the pitch is always loaded, so this is free; the MCP reader resolves it server-side and `get_pitch` returns both `core_scope_id` and a per-scope `core` flag so an agent needs no join.
- `upsert_pitch` must leave `core_scope_id` untouched when omitted (ADR 0011), and a new pitch defaults it unset.
- Reordering scopes or changing a tier never touches the core — the pointer is independent of list index and tier.
- Had we picked the boolean, single-select would have required a reconcile-on-conflict path; the pointer removes that class of bug entirely.
