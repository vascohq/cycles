import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getIntegrationConfig } from '@/lib/calendar/org-integrations'
import { IntegrationsForm } from './integrations-form'
import { SlackWebhookForm } from './slack-webhook-form'

export const metadata: Metadata = {
  title: 'Integrations | Settings | Cycles',
}

export default async function IntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authResult = await auth()
  const { userId, orgId, orgSlug, has } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const urlSlug = orgSlug ?? 'me'
  if (slug !== urlSlug) redirect(`/${urlSlug}/settings/integrations`)

  const header = (
    <header className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={`/${slug}/cycles`} className="transition-colors hover:text-foreground">
          Cycles
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Integrations</span>
      </nav>
      <h1 className="font-display text-3xl">Integrations</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Connect calendar feeds to show <strong>Holidays</strong> and{' '}
        <strong>Time&nbsp;Off</strong> on the cycle window. Paste an{' '}
        <code>.ics</code> or <code>webcal://</code> URL. Feed URLs are stored
        privately and never shown to people viewing a cycle.
      </p>
    </header>
  )

  // Personal workspaces have no org to configure.
  if (!orgId) {
    return (
      <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-6 py-8">
        {header}
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Integrations are configured per organization. Switch to an organization to manage them.
        </p>
      </main>
    )
  }

  const isAdmin = has({ role: 'org:admin' })

  // Non-admins never receive the capability URLs: don't read or pass the config.
  if (!isAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-6 py-8">
        {header}
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Only organization admins can manage calendar integrations.
        </p>
      </main>
    )
  }

  const config = await getIntegrationConfig(orgId)

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-8 px-6 py-8">
      {header}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Calendar feeds
        </h2>
        <IntegrationsForm initialFeeds={config.feeds} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Slack
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Incoming webhook URL for posting needle updates. Leave blank to disable
          Slack delivery for this organization.
        </p>
        <SlackWebhookForm initialUrl={config.slackWebhookUrl ?? ''} />
      </section>
    </main>
  )
}
