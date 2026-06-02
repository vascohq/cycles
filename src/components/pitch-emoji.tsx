'use client'

import { useEffect, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { normalizeEmoji } from '@/lib/pitch-identity-engine'
import { cn } from '@/lib/utils'

type PitchEmojiProps = {
  /** The pitch's current emoji, or '' when unset. */
  emoji: string
  /**
   * Called with the normalized emoji ('' clears it) when edited. Omit to render
   * a read-only glyph (no placeholder, no click target).
   */
  onChange?: (emoji: string) => void
  /** Tailwind text-size class for the glyph. Defaults to a hero-sized glyph. */
  className?: string
}

/**
 * A pitch's identity glyph. Shows the emoji when set; when editable and unset it
 * shows a faint placeholder. Clicking (when editable) swaps to a single-emoji
 * input that normalizes through the pitch identity engine on commit.
 */
export function PitchEmoji({ emoji, onChange, className }: PitchEmojiProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(emoji)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Read-only: render the glyph only when there's something to show.
  if (!onChange) {
    if (!emoji) return null
    return (
      <span className={cn('leading-none', className)} aria-hidden>
        {emoji}
      </span>
    )
  }

  const commit = () => {
    const next = normalizeEmoji(draft)
    if (next !== emoji) onChange(next)
    setDraft(next)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(emoji)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        aria-label="Pitch emoji"
        className={cn(
          'w-[1.5em] bg-transparent text-center leading-none outline-none',
          'rounded ring-2 ring-ring',
          className
        )}
        // Long enough for ZWJ / skin-tone sequences; normalizeEmoji enforces one.
        maxLength={16}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(emoji)
        setEditing(true)
      }}
      aria-label={emoji ? 'Change pitch emoji' : 'Add pitch emoji'}
      title={emoji ? 'Change emoji' : 'Add emoji'}
      className={cn(
        'leading-none rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {emoji || (
        <SmilePlus
          className="size-[0.8em] text-muted-foreground/40"
          strokeWidth={1.75}
        />
      )}
    </button>
  )
}
