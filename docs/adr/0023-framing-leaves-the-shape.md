# ADR 0023: Framing leaves the Shape; the `framing` stage is dropped

## Status

Accepted. Amends [ADR 0016](0016-mission-control-pitch-timeline.md) where it renders a stage badge.

## Context

`CyclePitch.stage` had four values: `framing`, `shaping`, `building`, `done`.

[ADR 0022](0022-the-frame-is-the-captured-unit.md) moves framing onto the **Product Map**. A **Shape** exists because framing already produced a sharp **Frame** worth shaping. A shape in `framing` therefore describes a state that can no longer happen.

## Decision

**Stage becomes `shaping`, `building`, `done`.** A new shape starts at `shaping`. Cooldown shapes still start at `building`. Existing rows in `framing` migrate to `shaping`, once.

**`shaping` stays.** The symmetry argument for dropping it as well is wrong. Framing left the cycle because it genuinely moved surfaces. Shaping did not move anywhere: build shapes do that work inside the cycle, which is why cooldown shapes skip it. Dropping `shaping` would delete a real state the team occupies.

## Considered options

- **Keep `framing` for shapes created with no frame.** Rejected. It keeps open a door to work sitting in a cycle with no frame, which is the thing Shape Up refuses.
- **Redefine `framing` as "has a frame, the frame is not sharp yet".** Rejected. That state belongs on the map, where a rough frame already shows it, and nothing may be bet on a rough frame.
- **Drop `shaping` too, for symmetry.** Rejected. See the decision above.

## Consequences

- **This is a breaking change** to the `Stage` type and to the MCP pitch tool enum.
- A stored `framing` value reads as `shaping`, because stored data outlives the code that wrote it. This is the same defence [ADR 0018](0018-kanban-is-a-view-not-an-entity.md) applied to card status.
- The stage badge loses one value.
- "Frame Go" as a shape rule moves to the map, as the derived **sharp** state on a frame.
- A shape in the `shaping` stage reads a little circular. The wart is accepted, because the alternatives are a synonym or a lie about where shaping happens.
