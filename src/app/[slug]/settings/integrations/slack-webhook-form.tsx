'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { saveSlackWebhook } from './actions'

export function SlackWebhookForm({ configured }: { configured: boolean }) {
  const [url, setUrl] = useState('')
  const [isConfigured, setIsConfigured] = useState(configured)
  const [isSaving, startSaving] = useTransition()
  const { toast } = useToast()

  const run = (value: string, successTitle: string) =>
    startSaving(async () => {
      const result = await saveSlackWebhook(value)
      if (result.ok) {
        setIsConfigured(Boolean(value.trim()))
        setUrl('')
        toast({ title: successTitle })
      } else {
        toast({ title: 'Could not save', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {isConfigured && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-green-600" />
          A webhook is configured.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="flex-1 font-mono text-xs"
          placeholder={
            isConfigured
              ? '•••••••• saved — paste to replace'
              : 'https://hooks.slack.com/services/…'
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => run(url, 'Slack webhook saved')}
          disabled={isSaving || !url.trim()}
        >
          {isSaving ? 'Saving…' : isConfigured ? 'Replace' : 'Save'}
        </Button>
        {isConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => run('', 'Slack webhook cleared')}
            disabled={isSaving}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
