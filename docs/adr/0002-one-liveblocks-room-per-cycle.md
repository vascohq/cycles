# One Liveblocks room per cycle

Each cycle gets its own Liveblocks room (ID pattern: `{orgId}:cycle:{cycleSlug}`). All pitches, scopes, tasks, updates, and parking items for that cycle live in the same room. Both Mission Control (all pitches overview) and Scope Map (single pitch detail) connect to the same room.

We considered one room per org (ever-growing, all cycles in one room) and one room per pitch (clean isolation but Mission Control needs cross-room aggregation). Per-cycle is the right boundary: a cycle is a natural unit of work with a defined start/end, the data fits comfortably in one room, and everyone working on the cycle sees real-time updates across all pitches. When a cycle ends, its room becomes read-only (pitches in `done` stage) and a new cycle gets a fresh room.

## Consequences

- Mission Control is a single-room view — no cross-room aggregation needed.
- Cross-cycle views ("what shipped last cycle?") require reading from a different room via the REST API. This is acceptable because cross-cycle queries are rare and don't need real-time updates.
- The existing board rooms (`{orgId}:{boardSlug}`) are a separate concept and continue to work until retired.
