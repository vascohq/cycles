'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { validateNotionUrl } from '@/lib/pitch-identity-engine'
import { cn } from '@/lib/utils'

type NotionLinkPillProps = {
  /** The pitch's Notion URL, or '' when unset. */
  url: string
  /**
   * Called with the new URL ('' clears it) on commit. Omit to render a
   * read-only pill (nothing when there's no link).
   */
  onChange?: (url: string) => void
  className?: string
}

/** The Notion logo mark (monochrome, inherits text color). */
function NotionGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-3.5', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M4.6 3.2 14 2.5c1.2-.1 1.5 0 2.2.5l3 2.1c.5.4.7.5.7 1v13c0 .9-.3 1.4-1.4 1.5l-10.9.7c-.8 0-1.2-.1-1.6-.6l-2.2-2.9c-.4-.6-.6-1-.6-1.5V4.7c0-.8.3-1.4 1.8-1.5Z M14.3 5 5 5.6c-.3 0-.4.1-.4.3l.2.2 1 .8c.3.2.5.2 1 .2l8.7-.5c.2 0 .3-.1.3-.3l-.4-1c-.1-.3-.4-.5-1.1-.4Z M6.4 8.4v9.2c0 .5.2.7.8.6l9.6-.5c.5 0 .6-.3.6-.7V8.4c0-.4-.2-.6-.6-.6l-9.8.6c-.4 0-.6.2-.6.6Z" />
    </svg>
  )
}

const pillBase =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function NotionLinkPill({ url, onChange, className }: NotionLinkPillProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Read-only: render the pill only when there's a link.
  if (!onChange) {
    if (!url) return null
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(pillBase, 'bg-muted hover:bg-muted/70', className)}
      >
        <NotionGlyph />
        Notion
      </a>
    )
  }

  const trimmed = draft.trim()
  const validation = trimmed ? validateNotionUrl(trimmed) : null
  const invalid = !!validation && !validation.isValidUrl
  const hostWarning = !!validation && validation.isValidUrl && !validation.isNotionHost

  const commit = () => {
    const next = draft.trim()
    if (!next) {
      if (url) onChange('')
      setEditing(false)
      return
    }
    // Hard-reject a non-https / malformed URL: stay in the editor.
    if (!validateNotionUrl(next).isValidUrl) return
    if (next !== url) onChange(next)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(url)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            placeholder="https://notion.so/…"
            aria-label="Notion link URL"
            aria-invalid={invalid}
            className="h-7 w-56 rounded border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={commit}
            disabled={invalid}
            aria-label="Save Notion link"
            className="grid size-7 place-items-center rounded border text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="grid size-7 place-items-center rounded border text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {invalid && (
          <p className="text-xs text-destructive">Enter a valid https:// URL.</p>
        )}
        {hostWarning && (
          <p className="text-xs text-muted-foreground">
            That&apos;s not a Notion link — it&apos;ll be saved anyway.
          </p>
        )}
      </div>
    )
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft('')
          setEditing(true)
        }}
        aria-label="Add Notion link"
        className={cn(
          pillBase,
          'border-dashed text-muted-foreground/70 hover:text-foreground hover:border-solid',
          className
        )}
      >
        <NotionGlyph className="opacity-70" />
        <Plus className="size-3" />
        Notion
      </button>
    )
  }

  return (
    <span className={cn(pillBase, 'bg-muted hover:bg-muted/70', className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NotionGlyph />
        Notion
      </a>
      <button
        type="button"
        onClick={() => {
          setDraft(url)
          setEditing(true)
        }}
        aria-label="Edit Notion link"
        // Slides in from collapsed (zero width) when the hero header is hovered;
        // the negative margin cancels the pill's gap while hidden so there's no
        // dead space.
        className="grid place-items-center overflow-hidden rounded text-muted-foreground transition-all duration-200 -ml-1.5 w-0 opacity-0 hover:text-foreground group-hover/hero:ml-0 group-hover/hero:w-4 group-hover/hero:opacity-100 focus-visible:ml-0 focus-visible:w-4 focus-visible:opacity-100"
      >
        <Pencil className="size-3 shrink-0" />
      </button>
    </span>
  )
}
