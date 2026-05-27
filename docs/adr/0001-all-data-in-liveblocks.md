# All data in Liveblocks, no database

The new Cycles features (Mission Control, Scope Map, Tuesday updates) store all data in Liveblocks rooms — no traditional database. We considered a hybrid approach (Liveblocks for real-time scope/task state, Postgres for pitch metadata and updates) but chose to keep a single data layer because the data volume per cycle is small (~8 pitches, ~70 scopes, ~500 tasks, ~50 updates), Liveblocks handles this easily, and a single source of truth avoids sync complexity. Server-side actions (Slack delivery, MCP writes) use the Liveblocks Node.js REST API to read and write room storage.

## Considered Options

- **Full Liveblocks (chosen):** One data layer, real-time everywhere, no ORM/migrations. Mission Control and Scope Map are views of the same room. Server actions use the REST API.
- **Hybrid (Liveblocks + Postgres):** Real-time for scopes/tasks, DB for pitch metadata and updates. Cleaner for Mission Control queries but introduces two sources of truth and sync logic.
- **Full Postgres:** Abandon Liveblocks as data layer, use it only for presence. Most conventional but loses the real-time collaboration that's already working.

## Consequences

- A Postgres connection string exists in `.env.example` but remains unused. No ORM dependency needed.
- The MCP server and Slack integration write to Liveblocks via REST API, not direct DB access.
- If data volume ever outgrows a single room (unlikely for Shape Up cycle sizes), the migration path is to a database — but that's a future pitch, not a v1 concern.
