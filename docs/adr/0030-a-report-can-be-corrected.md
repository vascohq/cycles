# ADR 0030: A report can be corrected

## Status

Accepted. Changes how a **Report** behaves after it is written. ADR 0024 (wake) and ADR 0026 (delete) stand.

## Context

A **Report** could be added to a frame, but never edited or deleted. The app offered only "Add a report", and the MCP had only `map_attach_report`.

A report written badly stayed on the frame for good. For example, a capture session wrote ten one-line reports that named an internal tool and did not explain it. A reader with no background could not use them.

The only fix was to add a corrected report. That is worse than no fix. A report is one record of the problem happening, so a second report counts as the problem happening again. The pin grows, the frame wakes, and the **Heat lens** reads a signal that did not occur.

## Decision

**A report can be edited and deleted, in the app and through the MCP.** An edit replaces the report in place. A delete removes it.

**An edit can change the text, the link, the customer label and the source.** The date and the capturer do not change. They say when the problem happened and who recorded it, and a correction does not change either fact. A change of source moves the report from one heat lens to the other. That is a valid correction.

**An edit records `edited_on` and `edited_by` on the report.** The app shows "edited" next to the report. There is no change log, and the old text is not kept.

**A save that changes no field is not an edit.** It leaves no "edited" mark. **A report that moves to `internal` loses its customer label**, the same rule that capture follows.

**An edit never wakes the frame and never changes the report count.** It is not a new mention of the problem.

**A delete lowers the count by one and does not rewind the freshness clock.** To rewind, the app would have to replay every wake. A wake from a transcript through `map_wake_frame` is not stored, so that replay is not possible.

**Any member of the org can edit or delete a report.** The Product Map has no role model (ADR 0026). An agent captures many reports, so "only the capturer edits" would leave those reports with no human who can fix them.

**Every report has an id.** A new report gets a nanoid. A report written before ids existed has no stored id. Its id is derived from its capturer, its date and its text, so no migration is necessary. The first correction on a frame stores the ids of all its reports, so a derived id does not change after that. Identical old reports get a numbered suffix, so each one has its own id.

**The MCP gets `map_update_report` and `map_delete_report`.** `map_update_report` is a partial update (ADR 0011). `map_delete_report` declares `destructiveHint`. `map_attach_report` always adds a new report, so the tool names make it clear that only an add changes the count.

## Considered options

- **Add a corrected report next to the bad one.** Rejected. It counts as the problem happening again.
- **An `id` on `map_attach_report` that turns it into an upsert.** Rejected. "Attach" would then sometimes add and sometimes edit, and only an add changes the count.
- **Only the capturer edits, and only an admin deletes.** Rejected. An agent-captured report has no human capturer, and there is no admin role.
- **A change log on the frame that keeps the old text.** Deferred. Nobody has asked to read an old version yet.
- **A one-time migration that stores ids on old reports.** Rejected. A derived id needs no migration, and the first correction stores it.

## Consequences

- A frame shows the evidence that someone corrected, not the evidence that someone wrote first.
- The report count means the number of times the problem happened, and only an add or a delete changes it.
- `map_list_frames` returns an id on every report.
