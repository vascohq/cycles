# ADR 0031: A pitch can move to another cycle

## Status

Accepted. Builds on ADR 0002 (one room per cycle) and ADR 0003 (slug-path addressing).

## Context

A pitch could not leave the cycle it was created in. A bet that slipped to the next cycle had to be created again by hand in the new cycle: the pitch, every scope, every card, the parking lot. The needle history was lost, because an update cannot be written by hand.

Each cycle is its own Liveblocks room (ADR 0002). A move therefore crosses two storage documents, and Liveblocks has no transaction that spans two rooms.

## Decision

**A pitch moves with everything under it.** That is its scopes, its cards (scoped and Unscoped, ADR 0018), its needle updates and its parking items. The pitch keeps all its fields: stage, needle, timebox, frame link and Core Scope.

**Ids do not change.** Scopes, cards, updates and the Core Scope pointer refer to each other by id, so keeping the ids keeps every link inside the pitch valid. Ids are nanoids, so a clash in the target cycle is not a practical risk.

**The squad is matched by name.** Squads are per cycle (ADR 0009). The target cycle's squad with the same name takes the pitch. When there is none, the move creates it, with the source color if no target squad uses that color. The source squad stays, because other pitches may use it.

**Copy first, then remove exactly what was copied.** A Liveblocks storage mutation is not a transaction. It works on a snapshot of the room and streams its ops. So the move reads the subtree from one snapshot of the source room, adds to the target every record of it that the target does not hold yet (by id), and only then deletes those same records from the source. Nothing is sent to the source before the copy succeeds.

- A failure before or during the copy leaves the source untouched.
- A failure after the copy leaves the pitch in both cycles, never in neither. A second call finishes the move. It copies whatever was added in the source since the first attempt, leaves records the target already holds as they are, and then removes from the source.
- A record somebody adds to the pitch in the source during the move, between the snapshot and the removal, is not moved. It stays in the source cycle without a pitch and does not show. The window is one write to the target, so the risk is accepted.

**A title clash refuses the move.** Pitches are addressed by the slug of their title (ADR 0003). A second pitch with the same slug in the target cycle could not be reached by its URL or its slug path. The move changes nothing and asks the caller to rename one of the two.

**The move is not destructive.** Moving the pitch back undoes it. The MCP tool `move_pitch` does not declare `destructiveHint`.

**`move_pitch` is not available in `batch`.** A batch holds one room open (ADR 0003), and a move needs two.

**In the app, the Scope Map has a pitch menu with "Move to cycle…".** It lists the cycles that are not archived. An archived cycle is out of the way on purpose (ADR 0019), and a pitch moved into one would disappear. The MCP tool accepts any cycle of the org.

## Considered options

- **Rebuild the pitch with new ids in the target.** Rejected. Every internal reference would have to be remapped, and a retry after a failure would make a second copy.
- **Remove first, then copy.** Rejected. A failure between the two would lose the pitch.
- **Rename the moved pitch on a title clash (for example "Billing (2)").** Rejected. The caller would get a pitch with a name nobody chose.
- **Keep a stub in the source cycle that points to the new one.** Deferred. Nobody has asked for it, and the Product Map already finds a frame's shapes across cycles (ADR 0022).
