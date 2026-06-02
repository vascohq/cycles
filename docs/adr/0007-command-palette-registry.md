# The command palette reads pitches from a registry, not the room

The ⌘K command palette navigates across **cycles** (always) and the **pitches of the current cycle** (only while inside it). It mounts once in the org layout (`src/app/[slug]/layout.tsx`) so the hotkey works on every page under `/[slug]`. But pitches live only inside a cycle's Liveblocks room storage ([ADR 0001](0001-all-data-in-liveblocks.md), [ADR 0002](0002-one-liveblocks-room-per-cycle.md)), and the room is only opened — via `CycleRoomProvider` — *deeper* in the tree, on Mission Control and Scope Map. The palette therefore cannot call `useCycleStorage()` from where it lives.

We bridge that gap with a **registry**: a `CommandPaletteProvider` in the org layout owns the open state, the hotkey, and the lazily-fetched cycle list; the page that currently has the room open calls `useRegisterPalettePitches(pitches)` to push its pitch list up into the provider, clearing it on unmount. The palette renders whatever is registered.

## Status

accepted

## Considered options

- **Registry — pages register pitches upward (chosen).** The page already subscribes to the room and holds the pitches, so it is the single source of truth; the palette just displays them. Pitches naturally appear only when a room is open and vanish on navigation away. Generalizes to "any page can register arbitrary commands" later (e.g. "Move the needle", "Create pitch") without touching the provider.
- **Palette re-opens the room from the URL.** The palette would read the current cycle slug via `usePathname()` and open its own Liveblocks subscription to read pitches. Rejected: a second subscription to the same room, duplicated room-setup logic, and a needle's-eye view of storage living in two places that can drift.
- **Index pitches across all cycles server-side.** Would enable cross-cycle pitch search, but there is no queryable pitch index — it would mean opening every room on each fetch, or maintaining an external index synced on every pitch write. Rejected as out of scope; deferred until cross-cycle pitch search is actually wanted.

## Consequences

- **Cycles are listed everywhere; pitches only inside a cycle.** This asymmetry is intentional and falls out of where the room is open. On the `/cycles` list page the Pitches group is simply absent.
- **The cycle list is fetched lazily on first open** (`listCycles` server action) and cached for the session, so no page under `/[slug]` pays a `getRooms` call unless the palette is actually used. The list can go stale within a session (a cycle created elsewhere won't appear until reload) — an accepted trade for keeping every page render cheap.
- **Registration is keyed on a stringified item list** so the effect doesn't re-fire each render; callers pass a memoized array built from live storage, so the palette tracks pitch title/stage/zone edits in real time.
- **`useRegisterPalettePitches` no-ops outside the provider**, so Mission Control and Scope Map remain renderable in isolation (tests, Storybook) without a palette context.
- **Cross-cycle pitch search remains a clean future step:** swap the registry's per-room source for a server-fed index without changing the palette UI.
