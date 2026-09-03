# ADR 0027: An agent draws the land; islands are derived

## Status

Accepted. Amends the shape decision in [ADR 0021](0021-product-map-is-org-scoped.md).

## Context

The Product Map generated every **Area** shape from a coarse grid position. The stated reason was that an agent must be able to create an area, and an agent cannot draw.

That reason is wrong. An agent writes a ring of coordinates as easily as it writes a name. The real limit is uploaded artwork: an agent cannot paint into a raster image, and the pitch's out-of-scope note meant that, not vector geometry.

The cost of the generated shape was high. Areas drew as rectangles on a grid, three across. The map looked like a form, and the team's own drawings of their product looked nothing like it. Nobody could point at the artifact and say "this is where our product hurts".

The team's drawings showed three levels: one outer coastline, islands inside it, and named regions inside those, divided by dashed lines. A true partition of a polygon needs polygon-splitting code, which is the expensive part of that picture.

## Decision

**An agent draws the coastline of an area.** An area carries an optional `outline`: a closed ring of `[x, y]` points in one world space, 0 to 1000 on both axes. About 8 to 14 points reads as land. The ring closes itself.

**A generated ring is the fallback, not the rule.** An area with no outline gets a ring generated around its grid cell, seeded from its id. Nothing needs migrating, and an area created before this ADR still renders as land.

**An island and an archipelago are never drawn and never stored.** An **Area** that holds areas is an **Island**. An **Area** that holds islands is an **Archipelago**. Both draw as the merged silhouette of the leaf areas underneath them. The silhouette comes from an SVG filter: blur the children, harden the haze back into one shape with an alpha matrix, then erode and composite to leave a coastline ring.

The filter replaces a polygon union. A union needs a clipping library and produces a stiffer shape. The filter needs no dependency and fuses neighbours the way the team's drawings do.

**The silhouette is pixels, not geometry.** It cannot be hit-tested and it has no centroid. Clicks land on the children and on the bubbles instead, and a container's label sits at the centre of its children's box.

**Only three levels get a coastline.** Anything deeper draws as a label alone. Four levels of coastline is past the legibility ceiling, which is the same reason a **Pin** carries four channels and no more.

**A container's own outline is ignored.** An island's coastline is the silhouette of its children, so an outline stored on an island has no meaning. An area that gains a child stops drawing its own ring.

**A human does not edit geometry in this version.** A person renames an area, moves it, and asks the agent to redraw it. Vertex editing needs a small vector editor and gets its own decision.

## Consequences

The map looks like the team's own product, and the picture an agent draws from a description is the picture everyone sees.

`map_upsert_area` gains an optional `outline`. It follows [ADR 0011](0011-mcp-upsert-tools-are-partial-updates.md): omitting the field leaves the coastline unchanged, so a rename or a wake never erases a drawing. An empty array clears it back to a generated ring.

The writer refuses a malformed ring rather than drawing a sliver nobody can see: fewer than 3 points, more than 64 points, a point that is not a pair, or a coordinate that is not a finite number.

The grid position keeps one job. It places the generated fallback ring. It decides nothing for an area that carries an outline.

An agent can now draw two areas on top of each other, and nothing stops it yet. Overlap is deliberately left alone until the team sees a real map and judges whether it is a problem. When it needs an answer, the app separates the shapes at render time. Asking an agent to solve two-dimensional packing over MCP would let one capture reshuffle the whole map.

The vocabulary gains **Island**, **Archipelago**, and **Cluster**. "Cluster" names the zoom behavior and nothing else, so it must never name a group of areas.
