import { z } from 'zod'

// A capability URL (the secret is the token in the URL). `webcal://` and
// `https://` are both valid, so we require a non-empty string rather than a
// strict http(s) URL. `id` gives a feed a stable handle so its label can be
// edited without re-entering the (write-only) URL — see ADR 0014.
const feedSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['holiday', 'timeoff']),
  label: z.string(),
  url: z.string().min(1),
})

const integrationConfigSchema = z.object({
  feeds: z.array(feedSchema).default([]),
  // The org's Slack webhook (see #139). Optional/partial: omitting it must
  // leave any stored value untouched (ADR 0011) — the writer merges.
  slackWebhookUrl: z.string().min(1).optional(),
})

export type Feed = z.infer<typeof feedSchema>
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>

export function parseIntegrationConfig(raw: unknown): IntegrationConfig {
  return integrationConfigSchema.parse(raw)
}

// What the settings form submits per feed. URLs are write-only: a blank `url`
// means "keep the stored one" (the form never receives it to begin with).
export type FeedInput = {
  id: string
  kind: 'holiday' | 'timeoff'
  label: string
  url?: string
}

// What the settings page may safely send to the browser — never the URL.
export type RedactedFeed = {
  id: string
  kind: 'holiday' | 'timeoff'
  label: string
  hasUrl: boolean
}

export function redactFeeds(feeds: Feed[]): RedactedFeed[] {
  return feeds.map((f) => ({ id: f.id, kind: f.kind, label: f.label, hasUrl: Boolean(f.url) }))
}

/**
 * Merge the form's feed inputs over the stored feeds, preserving the write-only
 * URL: a row with a new `url` replaces it; a row with a blank `url` keeps the
 * stored one (matched by id); a stored feed absent from the inputs is dropped.
 * A brand-new row (id not stored) must carry a URL.
 */
export function mergeFeedInputs(existing: Feed[], inputs: FeedInput[]): Feed[] {
  const byId = new Map(existing.map((f) => [f.id, f]))

  return inputs.map((input) => {
    const url = input.url?.trim()
    if (url) {
      return { id: input.id, kind: input.kind, label: input.label, url }
    }
    const prior = byId.get(input.id)
    if (!prior) {
      throw new Error(`Feed "${input.label || input.id}" needs a URL.`)
    }
    return { id: input.id, kind: input.kind, label: input.label, url: prior.url }
  })
}
