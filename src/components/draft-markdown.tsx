'use client'

import { useState } from 'react'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'

/**
 * A Markdown field that reads as rendered text. A click (or Enter) opens the
 * textarea, and a blur commits and shows the rendered text again. Empty text
 * opens straight to the textarea, since there is nothing to read.
 *
 * Typed text commits on blur, not on every keystroke: a Liveblocks write per
 * character would fight the cursor of anyone else in the room.
 */
export function DraftMarkdown({
  value,
  rows,
  label,
  onCommit,
}: {
  value: string
  rows: number
  label: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  // Starts open when empty, so typing the first character does not flip the
  // field to rendered text under the cursor.
  const [editing, setEditing] = useState(!value.trim())

  if (editing || !draft.trim()) {
    return (
      <Textarea
        rows={rows}
        value={draft}
        aria-label={label}
        // Over existing text only a click mounts this, so focus follows it. An
        // empty field must not steal focus when the dialog opens.
        autoFocus={!!value.trim()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onCommit(draft)
        }}
      />
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label}`}
      // A link inside the text opens the link, not the editor.
      onClick={(e) => !(e.target as HTMLElement).closest('a') && setEditing(true)}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className="cursor-text rounded-md border border-input px-3 py-2 text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Markdown breaks>{draft}</Markdown>
    </div>
  )
}
