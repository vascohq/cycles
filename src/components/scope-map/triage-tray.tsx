'use client'

// Where Unscoped (triage) cards surface in Scope Map view — a self-hiding tray
// listing the pitch's cards that belong to no scope, each with an "assign to a
// scope" action (see ADR 0018). Hidden entirely when there's nothing to triage,
// so it's never a standing backlog (the deliberate edge of No Backlog, No Noise).

import { ChevronDown, Inbox } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export type TriageTask = { id: string; title: string }

export function TriageTray({
  tasks,
  scopes,
  onAssignScope,
}: {
  tasks: TriageTask[]
  scopes: { id: string; title: string; color: string }[]
  onAssignScope: (taskId: string, scopeId: string) => void
}) {
  // Self-hide when there's nothing to triage.
  if (tasks.length === 0) return null

  return (
    <section className="rounded-lg border border-dashed bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Triage</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length} unscoped {tasks.length === 1 ? 'card' : 'cards'}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={scopes.length === 0}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                Assign to scope
                <ChevronDown className="h-3 w-3 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {scopes.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => onAssignScope(t.id, s.id)}>
                    <span
                      className="mr-2 h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  )
}
