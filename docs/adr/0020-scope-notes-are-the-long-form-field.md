# Scope notes are the long-form field; litmus stays one stable line

A scope carries two prose fields with opposite jobs. **`litmus_text`** ("what it ships") is one short, stable line — the scope's headline promise, rendered on the card face. **`notes`** is a free-form markdown scratchpad of any length — context, decisions, links, open questions, findings — rendered **only in the scope drawer**, never on the card and never on Mission Control.

## Status

accepted

## Context

Until now `litmus_text` was the only prose field on a scope, so it absorbed everything anyone wanted to write down. This got acute once scopes were edited over MCP: with no other field available, agents wrote paragraphs of working context into "what it ships". Two failures followed.

The card face broke: [ADR 0007](0007-scope-cards-show-task-presence-not-completion.md) fixes the card at a uniform height with the litmus as its second line, which only works if the litmus is headline-length. And the litmus stopped being stable — a field that accumulates each session's findings gets rewritten constantly, when its value comes from staying still and being the one sentence the team agrees the scope delivers.

The underlying problem is that "the shortest field wins by default": absent somewhere better, detail lands wherever it can.

## Considered options

- **Keep one field and instruct agents to keep it short** — rejected. The detail is legitimate and has to go somewhere; a tool description cannot compete with the absence of any alternative. Agents (and people) will keep overflowing the only field that exists.
- **Reuse the pitch-level Parking Lot for scope detail** — rejected. Parking items are open decisions awaiting resolution, scoped to the pitch, and are surfaced as a list to work through. Working notes are neither decisions nor pitch-level, and burying them there would drown the real parking items.
- **A `notes` field, drawer-only (chosen)** — gives detail a home with room to grow, while the litmus goes back to being one short line. The drawer is already the single scope editor (ADR 0007), so nothing new is introduced in the layout.

## Consequences

- `notes` is optional on `CycleScope` — absent, not `''`, when unset — so scopes that predate the field read as "no notes" and a create that omits it doesn't plant an empty string. It follows the partial-update rule ([ADR 0011](0011-mcp-upsert-tools-are-partial-updates.md)): omit to leave unchanged, pass `''` to clear.
- The drawer renders notes **last**, after tasks: notes grow without bound, and tasks must stay reachable above them.
- Notes are the one long-form editor in the drawer, so they change all three inline-edit rules: Enter types a newline (blur saves, Esc reverts), emptying the field is a real clear rather than a revert, and focus lands the caret at the end instead of selecting everything — select-all over a page of notes is one keystroke from wiping it.
- `upsert_scope` takes `notes`, and `get_pitch` returns it. Both tool descriptions state the division of labour, so an agent with detail to record has an obvious place to put it that is not the litmus.
- Notes render as **markdown**, through the same shared `<Markdown>` component as update narratives, so the two long-form surfaces in the app read alike. People and agents both write markdown by reflex, and a notes field that showed raw `**` and `-` would be the one place in the app that punished it. Because markdown emits block elements (`<p>`, `<ul>`, tables), the long-form read view is a focusable `div` rather than the `button` the short fields use — a `<p>` inside a `<button>` is invalid HTML.
- Notes replace wholesale on write; there is no append operation. An agent adding to existing notes must read them first and pass the merged text.
