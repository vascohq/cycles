# ADR 0021: The Product Map is org-scoped and lives outside the cycle room

## Status

Accepted. Amends [ADR 0002](0002-one-liveblocks-room-per-cycle.md) in part.

## Context

ADR 0002 put all data in one Liveblocks room per cycle. That rule held while every entity belonged to a cycle.

The **Product Map** does not belong to a cycle. A **Frame** records a problem in the product. The problem exists before the first cycle and it outlives every cycle. Clean slate must never erase it.

The team also decided that agents drive every operation on the map. Existing MCP tools take a cycle slug ([ADR 0003](0003-mcp-server-with-slug-paths-and-batch.md)). Map tools have no cycle to name.

## Decision

**The Product Map lives in its own Liveblocks room, one per organization.** The room ID is `{orgPrefix}:product-map`. The route is `/[slug]/product-map`. The page loads with no cycle, so it works for an organization that has never created one.

Its MCP tools live in the same server as the cycle tools. They are org-scoped and they carry a `map_` prefix, so no caller confuses them with the cycle-scoped tools:

- `map_list_areas`, `map_upsert_area`, `map_delete_area`
- `map_list_frames`, `map_upsert_frame`, `map_resolve_frame`, `map_delete_frame`
- `map_wake_frame`
- `map_attach_report`
- `map_link_pointer`

Every one obeys [ADR 0011](0011-mcp-upsert-tools-are-partial-updates.md). All non-identity fields are optional, and the writer only writes what the caller sent. **A wake must never erase a frame.** The two delete tools are the exception to partial updates: they erase, and only for map hygiene ([ADR 0026](0026-a-frame-can-be-deleted-only-for-map-hygiene.md)).

`map_list_frames` needs a filter to return **Dormant** frames. There is no unfiltered dormant listing, by design.

## Considered options

- **Keep the map in each cycle room and copy it forward at cycle start.** Rejected. The map's history would scatter across rooms, and "how long has this frame been here" would have no answer.
- **A second MCP server for map tools.** Rejected. It doubles the auth and deployment surface for no gain.
- **Give map tools a cycle slug and ignore it.** Rejected. It is a lie in the tool schema, and every agent reads the schema.
- **Store the map outside Liveblocks, in a file or in Notion.** Rejected. Several people and several agents edit the map at the same time, which is what Liveblocks is for.

## Consequences

- ADR 0002's claim that all data lives in a per-cycle room is no longer true. ADR 0002 carries a note that points here.
- Cross-room reads appear. A frame lists the **Shapes** that attacked it, and those live in cycle rooms. These reads use the REST API, which ADR 0002 already anticipated for cross-cycle queries.
- No map tool can ever drop the `map_` prefix. The prefix is the only thing that separates the two scopes in the tool list.
- Clean slate never touches the Product Map.
- The Product Map is a valid landing surface for an organization with zero cycles.
