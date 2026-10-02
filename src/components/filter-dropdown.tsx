'use client'

import { X } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * A filter chip: an icon and a label, and the chosen value once set, with an X
 * to clear it. The Kanban board and the frame lists share it, so a filter
 * looks and works the same on every page.
 */
export function FilterDropdown({
  label,
  icon,
  value,
  onClear,
  children,
}: {
  label: string
  icon?: React.ReactNode
  value: string | null
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={`inline-flex items-center rounded-full border text-xs transition-colors ${
        value ? 'border-border bg-muted/60' : 'border-border bg-background'
      }`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium outline-none transition-colors hover:bg-muted ${
            value ? 'text-foreground pr-2' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {icon}
          {value ?? label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="flex h-full items-center pr-2 pl-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
