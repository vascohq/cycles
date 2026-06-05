'use client'

import { Star, ChevronDown } from 'lucide-react'

export type CoreScopePromptProps = {
  /** The pitch's scopes, offered as choices in the picker. */
  scopes: { id: string; title: string }[]
  /** Flag the chosen scope as the pitch's Core Scope. */
  onChoose: (scopeId: string) => void
}

// Empty-state nudge shown above the scope grid when a pitch has scopes but no
// Core Scope yet. It does double duty: it teaches a newcomer what a core scope
// is (Cycles leaves help signals for newcomers) and offers a one-step picker to
// set one. It is self-clearing — it vanishes the moment a core is set — so it
// carries no dismiss control (see ADR 0012, issue #121).
export function CoreScopePrompt({ scopes, onChoose }: CoreScopePromptProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-400/40 bg-amber-50/60 p-4 dark:border-amber-400/25 dark:bg-amber-400/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Star className="mt-0.5 h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Pick this pitch&apos;s core scope</p>
          <p className="text-sm text-muted-foreground">
            The core scope is the heart of the pitch — the slice you build first
            to prove the idea works and surface the real risks early.
          </p>
        </div>
      </div>
      {/* appearance-none + our own chevron so the caret keeps consistent
          breathing room from the edge across browsers (native carets sit flush
          against the border). pr-9 reserves room so the value never overlaps it. */}
      <div className="relative flex-shrink-0">
        <select
          aria-label="Choose core scope"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onChoose(e.target.value)
          }}
          className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Choose core scope…
          </option>
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
      </div>
    </div>
  )
}
