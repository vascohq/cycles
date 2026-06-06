'use client'

import { useState, useTransition } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { FeedInput, RedactedFeed } from '@/lib/calendar/integration-config'
import { saveIntegrationFeeds } from './actions'

// A row carries the redacted feed (no URL) plus a write-only `url` field: blank
// means "keep the saved one" for an existing feed, or "missing" for a new one.
type Row = {
  id: string
  kind: 'holiday' | 'timeoff'
  label: string
  hasUrl: boolean
  url: string
}

const toRows = (feeds: RedactedFeed[]): Row[] => feeds.map((f) => ({ ...f, url: '' }))

export function IntegrationsForm({ initialFeeds }: { initialFeeds: RedactedFeed[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialFeeds))
  const [isSaving, startSaving] = useTransition()
  const { toast } = useToast()

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: nanoid(), kind: 'holiday', label: '', hasUrl: false, url: '' },
    ])

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  const save = () =>
    startSaving(async () => {
      const feeds: FeedInput[] = rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.label,
        url: r.url.trim() || undefined,
      }))
      const result = await saveIntegrationFeeds(feeds)
      if (result.ok) {
        // Clear the write-only inputs and mark every surviving row as saved.
        setRows((prev) => prev.map((r) => ({ ...r, hasUrl: true, url: '' })))
        toast({ title: 'Integrations saved' })
      } else {
        toast({ title: 'Could not save', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No feeds yet. Add one to start showing holidays and time off.
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
          >
            <Select
              value={row.kind}
              onValueChange={(value) => update(row.id, { kind: value as Row['kind'] })}
            >
              <SelectTrigger className="sm:w-36" aria-label="Feed type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="timeoff">Time Off</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="sm:w-40"
              placeholder="Label (e.g. Canada)"
              value={row.label}
              onChange={(e) => update(row.id, { label: e.target.value })}
            />
            <Input
              className="flex-1 font-mono text-xs"
              placeholder={
                row.hasUrl ? '•••••••• saved — paste to replace' : 'https://… or webcal://…'
              }
              value={row.url}
              onChange={(e) => update(row.id, { url: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove feed"
              onClick={() => removeRow(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-3 w-3" />
          Add feed
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
