'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { saveSlackWebhook } from './actions'

export function SlackWebhookForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl)
  const [isSaving, startSaving] = useTransition()
  const { toast } = useToast()

  const save = () =>
    startSaving(async () => {
      const result = await saveSlackWebhook(url)
      toast(
        result.ok
          ? { title: url.trim() ? 'Slack webhook saved' : 'Slack webhook cleared' }
          : { title: 'Could not save', description: result.error, variant: 'destructive' }
      )
    })

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
      <Input
        className="flex-1 font-mono text-xs"
        placeholder="https://hooks.slack.com/services/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button type="button" size="sm" onClick={save} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
