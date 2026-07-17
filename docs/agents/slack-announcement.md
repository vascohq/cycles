# Slack announcement format: shipped fixes & features

When announcing a Cycles change in Slack (default channel: **#product-dev**),
use this format. Send only after the requester approves the drafted message.

## Template

```
:cycles: *Cycles — shipped <fix|feature>* :white_check_mark:

*<One-line summary of the user-visible change.>*

<2–4 sentences: what it was like before, and what changes now. Lead with the
user impact, not the implementation. Name the affected surface in Cycles terms
(use CONTEXT.md vocabulary — e.g. "Scope Drawer", "Mission Control", "Needle").>

_<provenance, e.g. From the All-Squad retro>_ · PR: <url> · closes #<issue>
```

## Rules

- **Branding**: always lead with the `:cycles:` custom emoji and the `*Cycles — …*` title. `:white_check_mark:` for a shipped change.
- **Voice**: user-facing benefit first; the "before → now" contrast makes the fix concrete. Keep implementation detail to at most one clause in parentheses.
- **Terminology**: name features with the domain glossary in `CONTEXT.md`, never raw component names.
- **Links**: end with a single meta line — provenance · PR link · `closes #NNN`. Use plain `#NNN` (GitHub issue), a full PR URL.
- **No AI sign-off** in the message body.
- **Approval**: draft, get the requester's explicit OK, then send.

## Example

```
:cycles: *Cycles — shipped fix* :white_check_mark:

*Inline edits in the Scope Drawer no longer get lost when you click the backdrop to close.*

Before: editing a task title / scope name / "what it ships" in Cycles and then dismissing the drawer by clicking outside silently dropped your change (the input unmounted before it could save). Now clicking away — anywhere, including the backdrop — commits the edit; only Escape discards.

_From the All-Squad retro_ · PR: https://github.com/vascohq/cycles/pull/186 · closes #183
```
