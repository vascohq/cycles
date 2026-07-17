'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export type OlderGroup = {
  key: string
  /** Singular noun, e.g. "past" / "archived" — pluralized in the summary. */
  label: string
  count: number
  /** Pre-rendered <CycleRow> elements (server components passed as nodes). */
  rows: React.ReactNode
}

/**
 * The folded "older cycles" disclosure. Past and archived cycles recede here
 * (ADR 0015: folding is presentation) behind one control instead of two
 * stacked "Show N …" toggles. With both present, a segmented toggle switches
 * between them; with one, it's a plain list.
 */
export function OlderCycles({ groups }: { groups: OlderGroup[] }) {
  const [activeKey, setActiveKey] = useState(groups[0]?.key)
  if (groups.length === 0) return null

  const total = groups.reduce((n, g) => n + g.count, 0)
  const active = groups.find((g) => g.key === activeKey) ?? groups[0]
  const summary =
    groups.length === 1
      ? `Show ${total} ${active.label} ${total === 1 ? 'cycle' : 'cycles'}`
      : `Show ${total} older ${total === 1 ? 'cycle' : 'cycles'}`

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
        {summary}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {groups.length > 1 && (
          <div className="flex gap-1">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveKey(g.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  g.key === active.key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {g.label} {g.count}
              </button>
            ))}
          </div>
        )}
        <ul className="border rounded-lg divide-y opacity-60">{active.rows}</ul>
      </div>
    </details>
  )
}
