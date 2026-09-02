# ADR 0022: The Frame is the captured unit; a Shape snapshots it at bet time

## Status

Accepted.

## Context

Ryan Singer's later vocabulary splits the work in four parts. A pitch is the raw input that starts the conversation. A **frame** is the output of framing: a problem with business value and an appetite. Shaping is the work in the middle. The output of shaping is the thing a cycle contains.

Cycles held the frame on the pitch, as `frame_problem` and `frame_outcome`. That put framing inside a cycle. Framing happens before any bet exists, so it belongs on the **Product Map**.

Two naming problems came with this. "Pin" named the marker on the map, not the record, so it never named the thing. And "pitch" now means the opposite of Singer's current sense.

## Decision

**The Frame is the captured unit.** Every type of input needs a frame: a bug, an idea, a request, a security problem, an irritant, a win to unlock. A frame holds a problem, an **Appetite**, a business case, a **Kind**, a **Type**, an owner, **Reports**, and **Pointers**. A **Pin** is only how a frame is drawn on the map, and it holds no data.

**A frame packages pointers.** The artifacts live elsewhere: in GitHub, in Notion, in a wayfinder map. A frame never imports, never syncs, and never mirrors state. There is no second container object.

**The thing a cycle contains is a Shape.** Framing produces a frame; shaping produces a shape. A shape gains `frame_id`, a pointer home.

A shape keeps `frame_problem`, and the field changes meaning. It is now the **Frame as bet**: a copy of the frame's problem text, taken at the moment the bet was made. `frame_outcome` stays and keeps its meaning, because outcome is a product of shaping and a frame never holds one.

A frame is **sharp** when it has both a problem and an appetite, and **rough** when it does not. This is derived, never stored, in the same way [ADR 0015](0015-cycle-lifecycle-is-date-derived.md) derives cycle phase from dates. **Only a sharp frame can be bet on.**

The rename from Pitch to Shape is **deferred**. The stored type stays `CyclePitch` and the route stays `[pitchSlug]` until a dedicated cycle does the rename. The glossary uses **Shape** now, and records the lag.

## Considered options

- **Pointer only, with the shape rendering the frame's live text.** Rejected. A frame can carry several shapes across years, because shipping something rarely removes a pain completely. Reframing later would rewrite what a past cycle says it committed to. The app refuses self-rewriting history everywhere else (see [ADR 0005](0005-hill-movement-from-update-snapshots.md)).
- **Copy only, with no pointer.** Rejected. The shape would lose its way back to the problem, its reports, and its evidence.
- **A separate Package object holding the artifacts.** Rejected. The frame already carries the pointers, and a second dossier that closes at cycle end would split one problem's record across two objects.
- **Move `frame_outcome` to the frame.** Rejected. A frame with an outcome is a solution in disguise.
- **A stored `sharp` flag.** Rejected. Nobody remembers to set a flag, and the fields already say the truth.
- **Rename Pitch to Shape now.** Rejected for timing only. It touches the storage type, every MCP tool name, the route and every user's habit. A rename bug and a map bug would look identical during the build.

## Consequences

- A shape gains `frame_id`. The field is optional, because a shape created with no frame has none.
- `frame_problem` means "as bet". The UI labels it so. Editing a shape's frame never writes back to the frame on the map.
- A frame can carry many shapes over its life. The frame's detail lists them with their cycles.
- The **Candidate statement** is built from the problem and the appetite. Nobody types it and it is not stored.
- An agent can set an appetite through `map_upsert_frame`. The team chose to trust the caller and keep capture light. Every report records its capturer, so the provenance of a sharp frame stays visible.
- Until the rename lands, code says `pitch` and docs say **Shape**. The glossary states the mapping so an agent reading both does not guess.
