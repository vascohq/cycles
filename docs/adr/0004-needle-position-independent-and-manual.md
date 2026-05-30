# Needle position is independent and manual

The needle carries two signals — a position on the arc ("how far along") and a zone (sentiment/color). We make these fully independent: the team slides the position by hand and picks the zone separately, and neither is ever derived from the other, from task counts, or from hill progress. This replaces the earlier behavior where choosing a zone snapped the position to a fixed value (`on_track`→0.85, `some_risk`→0.5, `concerned`→0.2 via `snapForZone`), which made it impossible to express honest combinations like "far along but concerned."

We chose this over the obvious instinct to compute progress from completion (% tasks done, or hill positions) because the needle is deliberately a subjective read — the team's gut feel about how the pitch is going, not a calculation. Recording this prevents a future contributor from "helpfully" re-linking position to zone or wiring it to task/hill data, which would quietly destroy the signal the needle exists to carry.

Existing needle values stay valid positions, so no migration is needed.
