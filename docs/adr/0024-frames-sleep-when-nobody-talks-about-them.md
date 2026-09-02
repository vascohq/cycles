# ADR 0024: A frame sleeps when nobody talks about it

## Status

Accepted.

## Context

The **Product Map** must not become a backlog. A list of open problems that people sort and groom is a backlog, whatever it is called, and "No Backlog, No Noise" is a core principle of this tool.

The team needed the map to show what is top of mind, with nobody doing the grooming. The signal they chose is conversation: a problem that people still talk about is still live.

## Decision

**A frame has one freshness clock. Three events wake it:**

- a new **Report**
- a mention in a transcript, sent by an agent through `map_wake_frame`
- an explicit "still hurts" click

Nothing else wakes a frame. Opening a frame does not wake it, because browsing the map would then refresh the whole map and decay would die. Work on a linked **Shape** does not wake it either, because the map reports pain, not activity.

A frame dims through the cycle as its clock runs. At the end of a cycle, during cooldown, the app sweeps. A frame with no wake for two cycles becomes **Dormant** and leaves the map view. A dormant frame keeps every field, every report and its whole history. A mention wakes it back onto the map.

**Only a person removes a frame, through Resolve.** Nothing is deleted on a timer.

The betting table reads the map as a standing reference. After the table, an agent reads the notes and calls `map_wake_frame` for what came up. A review queue then shows at most ten dormant candidates, for the case the transcript missed one.

A **released** frame is treated no differently. Monitoring has no end condition, so a released frame that generated no complaints and no adoption worry sleeps like any other.

## Considered options

- **Delete old frames.** Rejected. Silent deletion makes the map lie about what the team knows.
- **Rank-based hiding, showing the top N frames per area.** Rejected. A busy area would bury live pain for being crowded, and a quiet area would keep a two-year-old frame on screen looking urgent.
- **Let past investment protect a frame from sleeping.** Rejected. Sunk cost is exactly what a "top of mind" map must not weight.
- **Match transcripts to frames inside the app.** Rejected. Text matching needs constant tuning and produces wakes nobody can explain. The judgement lives in the agent and the audit trail lives in the wake note.
- **Count weeks instead of cycles.** Rejected. Counting cycles means state only changes at a moment when somebody is looking.

## Consequences

- Dormant frames stay queryable through `map_list_frames`, and the query needs a filter. There is no browsable ranked list of dormant frames. A developer asking "what could I take" names an area or a **Type** first, and that friction is the point.
- The two thresholds (dim, sleep) are configuration, not constants, so the team can tune them after two cycles of real use.
- The sweep runs at cycle end, in cooldown, where housekeeping already belongs. This fits clean slate.
- The word "fog" is not used for this state. The wayfinder skill already uses it for decisions that cannot yet be phrased.
