# ADR 0029: A frame has its own page, with a brief that an agent left

## Status

Accepted.

## Context

A frame opened in a dialog on the **Product Map**. A dialog has no URL, so nobody could share a frame in Slack or link to it from a pitch.

The team also wanted one place that says where a frame stands and what comes next. That information sits in many places: the reports, the pointers, the shapes in the cycle rooms, and the Notion pitch. A person who reads all of it to answer "where are we?" does the same work every time.

## Decision

**Every frame has its own page at `/{slug}/product-map/frames/{frameId}`.** A click on a pin, on a list row or on an origin link opens this page. The page reads the frame and never wakes it, the same as the dialog did (ADR 0024). Editing stays in the frame dialog. The page opens the dialog from its Edit button, so a field means the same thing everywhere.

**The page shows a brief that an agent left, and never asks an agent live.** The **Brief** is one optional field on the frame. `map_write_brief` writes it and replaces it whole. The page shows the brief with its writer and its date. When nobody has written one, the page says so. "Ask Paulo" opens a new Claude chat with `/paulo` and the frame id already typed. Paulo reads the frame and writes a new brief.

**Writing a brief does not wake the frame.** A brief summarizes the record. It is not a new mention of the problem.

**The frame holds a draft Release announcement.** This is the note that customers would read after the problem is solved. The team writes it early, before anything is built, so the frame says what solving it means for the customer. The page marks it "Draft" until the frame is released. It is one more partial field on `map_upsert_frame` (ADR 0011).

**The page reads the squad and the Notion pitch from the shape.** Both live on the shape in its cycle room. The frame does not copy them (ADR 0022).

## Considered options

- **Generate the brief live when the page opens.** Rejected. Each page view then costs a model call, and two people see two different answers for the same frame. A stored brief with a date costs less and is the same for every reader.
- **Let a brief wake the frame.** Rejected. Paulo can write briefs for many frames in one run, and then the whole map stays awake. Only conversation about the problem wakes a frame.
- **Make the brief a partial field on `map_upsert_frame`.** Rejected. A partial update can leave an old warning under a new headline. A separate tool that replaces the whole brief keeps its lines consistent.
- **Keep the dialog and add a "Copy link" button.** Rejected. A link to a dialog needs a query parameter on the map page. The dialog also has no room for the brief and the timeline.

## Consequences

- A brief can be old. The page shows its date, so the reader can judge it. "Ask Paulo again" is one click.
- The "Ask Paulo" link opens claude.ai with the prompt filled in. This needs the product plugin in claude.ai. A team that works in Claude Code types the same prompt.
- The `/paulo` skill lives outside this repository. It must learn to call `map_write_brief`, and to draft a Release announcement through `map_upsert_frame`.
- A shape stores no bet date. The timeline on the page marks the start date of the cycle that holds the shape.
- The route `/e2e/product-map/frames/{frameId}` draws the page from fixture data, with no room and no editing. Playwright drives it.
