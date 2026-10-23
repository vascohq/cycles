# ADR 0032: The map holds requests, and framing returns to the pitch

## Status

Accepted. Supersedes the vocabulary of ADR 0022 and the decision of ADR 0023. The rest of ADR 0022 stands: a pitch points home to the record on the map, and the map record never points at the pitch.

## Context

The record on the Product Map was a **Frame**. Shape Up uses "frame" for the careful statement of a problem and its outcomes. The record on the map is raw intake: a bug, an idea, an ask, a security problem or an irritant that a person or an agent captured in one line. The people who capture problems do not frame them.

ADR 0023 moved framing out of the pitch and onto the map. As a result, the pitch had no stage where a team reworks a problem with research before it shapes a solution. The pitch kept only a copy of the problem text and a free-text outcome. The outcomes on the map record and the outcome on the pitch were not the same, and nothing copied one to the other.

The glossary also renamed the shaped bet from **Pitch** to **Shape**, because Ryan Singer's later vocabulary uses "pitch" for the raw input. The code was never renamed. Readers had to read "pitch" in the code as "shape".

## Decision

**The record on the Product Map is a Request.** A request is raw intake, and the map shows where each request is in its lifecycle. A request holds a short summary of the problem, an appetite, its outcomes, a business case, and everything it held before.

**The outcomes of a request are its acceptance criteria.** This is true for a bug too. The appetite of a request gives a pitch a timebox to start from.

**The shaped bet is a Pitch again.** A pitch has two parts. The **Frame** is the full problem, reworked with research, and its outcomes. The **Shape** is the high-level solution: the scopes, and visuals or a prototype. The raw input is now a request, so the reason to call the bet a "shape" is gone.

**The Type `request` becomes `ask`.** Without this change, a request could have the type "request". The playbook of `ask` does not change.

**The code type is `ProductRequest`.** The name `Request` hides the Fetch `Request` type, which the MCP auth and the API routes use.

**The rename covers the code, the MCP and the stored data.** The routes, the MCP tool names and parameters, the stored keys and the `product` plugin all say "request". The MCP keeps no alias for an old tool name. The stored data moves with a one-off migration, not with code that reads both names.

**Framing returns to the pitch.** A pitch starts in the upcoming cycle at a `framing` stage. It takes its outcomes and appetite from one or more sharp requests. The betting table keeps some pitches and deletes the others. The requests of a deleted pitch stay on the map. This part ships after the rename.

## Considered options

- **Keep "frame" for the record on the map.** Rejected. The word describes work that the map does not do.
- **Rename only the glossary and the UI, and keep `frame` in the code.** Rejected. It recreates the "read pitch as shape" problem that this decision removes.
- **Read the old and the new stored keys forever.** Rejected. Nobody removes that code later.
- **Keep pitches before the bet in a pool that belongs to no cycle.** Rejected. That pool is a backlog.
- **Name the code type `Request`.** Rejected. It hides the Fetch `Request` type.
