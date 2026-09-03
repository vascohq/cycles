# ADR 0026: A frame can be deleted, and only for Product Map hygiene

## Status

Accepted — answers the hard-delete question that
[ADR 0019](0019-cycles-are-archivable-not-deletable.md) left open, and adds one
exit that [ADR 0024](0024-frames-sleep-when-nobody-talks-about-them.md) does not
name.

## Context

Capture on the Product Map costs nothing, by design. A frame needs a problem and
a **Type** and nothing else, so anybody notices a problem in one call.

A map that is cheap to write collects junk. It collects duplicates, frames
captured while somebody tested the tool, and frames captured against the wrong
product. None of these describe pain that a team has.

Until now the Product Map had no exit for them. **Resolve** is the exit for a
problem that a person decided is gone, and it keeps the frame with the **Shapes**
that closed it. Resolve on a test frame writes a record that lies: it says the
team had a problem and fixed it. **Dormancy** is worse for this case, because a
junk frame sleeps and then wakes the moment somebody says the words.

ADR 0019 refused a hard delete for a cycle and set the rule for this decision:
"if hard-delete is ever genuinely wanted, that is a further capability and
another ADR — do not add it by weakening this one." This is that ADR, and it
weakens nothing about cycles.

## Decision

**A frame and an area can be deleted, through `map_delete_frame` and
`map_delete_area`.**

- **Delete is for Product Map hygiene, and it is not part of a frame's
  lifecycle.** A frame that should never have been captured is deleted. A
  problem that a person decided is gone is resolved. The tool descriptions say
  which tool is for which case, so an agent does not delete a frame to mean
  "done".
- **Only a person or an agent asks for it.** Nothing deletes on a timer, and
  shipping a **Shape** never deletes the frame it came from. This is the same
  rule ADR 0024 set for Resolve.
- **Delete erases the record.** The problem, its **Reports** and its
  **Pointers** go, and no tool puts them back. Both tools declare
  `destructiveHint`, so a client asks the person first.
- **Deleting an area never deletes what is inside it.** Its frames return to
  **Unmapped**, and its sub-areas move to the top level. Each lifted sub-area
  takes a free grid slot, because its old position only made sense at its old
  depth.
- **Every reference in the Product Map room is cleared.** A frame that named the
  deleted frame in `origin_frame_id` loses that pointer. A sub-area of a deleted
  area loses `parentAreaId`.

## Open questions

Two questions are deferred, not resolved. Both need a decision before the next
change to these tools.

1. **A frame with a history.** Today `map_delete_frame` deletes a frame with 40
   reports as readily as an empty one. ADR 0024 rejected silent deletion because
   it "makes the map lie about what the team knows", and that reasoning applies
   to a frame with real evidence. The options are a guard with an explicit
   override, or no guard and a warning in the tool description.
2. **A Shape that points home.** [ADR 0022](0022-the-frame-is-the-captured-unit.md)
   gives a Shape a `frame_id`, its pointer home. That pointer lives in a cycle
   room, and the Product Map room cannot see it. A delete can leave a Shape
   pointing at a frame that is gone. The options are to refuse the delete while
   a Shape points home, or to accept the dangling pointer and say so.

## Considered options

- **Resolve as the only exit.** Rejected. It records that a problem was solved,
  which is false for a duplicate or a test.
- **A soft-delete flag, like `archived` on a cycle.** Rejected. The Product Map
  already has two states that hide a frame and keep it, which are Resolved and
  Dormant. A third would make four ways a frame can be off the map, and no
  reader could keep them apart.
- **Delete the whole area with everything in it.** Rejected. An area is a place
  on the Product Map. Losing the place must not lose the problems.
- **An `admin` restriction on delete.** Rejected for now. The Product Map has no
  role model, and inventing one for this tool alone would be the first.

## Consequences

- The Product Map now has four ways a frame leaves the view: Resolved, Dormant,
  Unmapped and deleted. Only the last one destroys data.
- ADR 0024's line "Only a person removes a frame, through Resolve" now reads as
  the rule for a problem that is gone. Delete is the other exit, for a frame
  that never described a problem.
- ADR 0019 stands. A cycle is still archivable and never deletable, because a
  cycle room holds everything a team made inside it.
- The two open questions above are the known gaps. A reviewer reads them as
  work, not as settled design.
