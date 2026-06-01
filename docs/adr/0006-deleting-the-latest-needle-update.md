# Deleting the latest needle update is a misfire undo, not history editing

Updates are immutable and append-only (see [CONTEXT.md](../../CONTEXT.md) and [ADR 0005](0005-hill-movement-from-update-snapshots.md)): the timeline is meant to be the honest story of how the team felt over time. We nonetheless allow **deleting the single latest update on a pitch** as a narrow escape hatch for a misfire — wrong pitch, fat-fingered position, duplicate post — caught moments after posting. Editing an update is still never allowed; the only correction is delete-and-repost.

## Status

accepted

## Considered options

- **General deletion (any update, any time)** — rejected. It directly contradicts the immutability principle and would let the timeline be quietly rewritten. It also makes the needle-revert rule ambiguous (deleting a middle update silently reshapes the hill trails of its neighbours).
- **No deletion at all** — rejected. A genuinely-erroneous post (wrong pitch, duplicate) shouldn't be permanent, and "post another update to correct it" leaves two contradictory rows in the honest story.
- **Latest-only deletion (chosen)** — keeps faith with immutability (you cannot retroactively change what you felt at a sealed checkpoint), makes the needle-revert unambiguous (always the prior update), and is symmetric with how the needle came to exist.

## Consequences

- **Two writes, the rest is derivation.** Deleting the latest update removes the row and reverts the pitch's denormalized `needle` to the prior update's Needle Snapshot — or `null` if it was the only update, returning the pitch to its unset/grey state. The needle Ghost, Hill Trails, and Hill History are pure functions over the remaining updates, so they rebase onto the new latest update with no extra code.
- **Scope hill positions are left untouched.** `hill_progress` is live, independently-dragged storage — never tied to an update — so the live dots stay where they are; only the baseline the trails diff against moves back one update.
- **The needle-revert rule is a shared invariant.** Both write paths (the client `useCycleMutation` in the Scope Map and the Node `liveblocks-writer` behind MCP) compute it through one tested pure helper (`needleAfterDeletingLatest` in `needle-engine.ts`) so they cannot drift.
- **Latest-only is enforced on both paths.** The UI only renders the affordance on the newest card; MCP's `undo_update` validates the id is the latest update for its pitch and errors otherwise — it is a data-integrity invariant, not a UI policy.
- **Slack is not touched.** The posted Slack message stays; we store no message id to delete it, and the misfire window is short. The UI confirm dialog says so.
- **"Done means sealed" stays a UI affordance, not an MCP rule.** The Scope Map hides delete (and every other mutation) once a pitch is done, but MCP — which gates no write tool on stage today — does not. Should sealing-on-done become a true invariant, it would be enforced across all MCP write tools at once, not bolted onto this one.
