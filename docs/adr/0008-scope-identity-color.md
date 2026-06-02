# Scope identity color replaces tier color on the badge and hill dot

Each scope gets a unique **identity color** (a `color` field), painted on its order badge and its dot on the hill chart, so scopes are tellable apart at a glance — especially on the hill chart, where same-tier scopes were previously identical-colored dots distinguished only by number. **Tier** stops being color-encoded and is shown as a neutral, monochrome text badge (must/should/could) instead, so it never competes with the identity-color channel.

## Status

accepted

## Context

Previously **Tier** *was* color (red/orange/grey on dots and badges), per the old [CONTEXT.md](../../CONTEXT.md). That made every "must" scope look identical on the hill chart. Giving each scope its own color requires reclaiming the color channel from tier — you cannot have a badge be both tier-red and identity-blue.

## Decision

- **Color owns the badge + hill dot.** Tier moves to a neutral text badge (no hue), distinguished by weight/opacity only, so it cannot be confused with a scope whose identity color happens to be red/orange/grey.
- **Curated palette of 12** hand-tuned colors: mutually distinct, legible as a dot on both light and dark card backgrounds, each paired with a contrast-safe number color.
- **Number contrast** is computed, not stored: `readableTextColor(hex)` uses WCAG relative luminance to pick near-black or near-white. Theme-independent — the color is constant across light/dark; only the number flips.
- **No duplication, ever.** Auto-assignment (create, "if not set", MCP) prefers an unused palette color chosen for greatest hue distance from in-use siblings; once all 12 are used it **generates** a new color in the largest hue gap at a legible saturation/lightness band. Deterministic — no `Math.random` in assignment, so it is testable and replay-safe.
- **Manual picker (drawer)** shows the palette with sibling-used colors flagged ("in use", dimmed) but still selectable. Uniqueness is guaranteed on auto-assign; manual override is allowed.

## Consequences

- A pure `color-engine.ts` (`relativeLuminance`, `readableTextColor`, `assignScopeColor`, hue-gap helpers) holds all the logic and is unit-tested in isolation.
- Scopes predating this feature have no stored color; their display color is derived deterministically across siblings so they look distinct immediately, and is persisted on the next edit.
- The hill chart no longer encodes tier at all; tier is read from the card/drawer badge. This is intentional — the chart's job is figured-out-ness and per-scope identity, not priority.
