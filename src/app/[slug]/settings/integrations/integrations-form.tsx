'use client'

import { useState, useTransition } from 'react'
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
import type { Feed } from '@/lib/calendar/integration-config'
import { saveIntegrationFeeds } from './actions'

// Local rows carry a stable key for React; it never leaves the browser.
type Row = Feed & { key: string }

let counter = 0
const newKey = () => `row-${counter++}`

const toRows = (feeds: Feed[]): Row[] => feeds.map((f) => ({ ...f, key: newKey() }))

export function IntegrationsForm({ initialFeeds }: { initialFeeds: Feed[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialFeeds))
  const [isSaving, startSaving] = useTransition()
  const { toast } = useToast()

  const update = (key: string, patch: Partial<Feed>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows((prev) => [...prev, { key: newKey(), kind: 'holiday', label: '', url: '' }])

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  const save = () =>
    startSaving(async () => {
      const feeds: Feed[] = rows.map(({ key: _key, ...feed }) => feed)
      const result = await saveIntegrationFeeds(feeds)
      toast(
        result.ok
          ? { title: 'Integrations saved' }
          : { title: 'Could not save', description: result.error, variant: 'destructive' }
      )
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
            key={row.key}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
          >
            <Select
              value={row.kind}
              onValueChange={(value) => update(row.key, { kind: value as Feed['kind'] })}
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
              onChange={(e) => update(row.key, { label: e.target.value })}
            />
            <Input
              className="flex-1 font-mono text-xs"
              placeholder="https://… or webcal://…"
              value={row.url}
              onChange={(e) => update(row.key, { url: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove feed"
              onClick={() => removeRow(row.key)}
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
