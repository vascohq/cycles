import { z } from 'zod'

// A capability URL (the secret is the token in the URL). `webcal://` and
// `https://` are both valid, so we require a non-empty string rather than a
// strict http(s) URL.
const feedSchema = z.object({
  kind: z.enum(['holiday', 'timeoff']),
  label: z.string(),
  url: z.string().min(1),
})

const integrationConfigSchema = z.object({
  feeds: z.array(feedSchema).default([]),
})

export type Feed = z.infer<typeof feedSchema>
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>

export function parseIntegrationConfig(raw: unknown): IntegrationConfig {
  return integrationConfigSchema.parse(raw)
}
