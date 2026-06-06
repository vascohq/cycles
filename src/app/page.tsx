import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listCycles } from './[slug]/cycles/actions'
import { resolveLanding } from '@/lib/cycle-list-engine'
import { getTeamToday } from '@/lib/team-time'

export default async function Home() {
  const authResult = await auth()
  const { userId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  const slug = orgSlug ?? 'me'

  // Land on the current cycle when there is one (ADR 0015); otherwise fall back
  // to the list so the user can pick or create. "today" is the team's day, so
  // "current" is the same for everyone.
  const landing = resolveLanding(await listCycles(), getTeamToday(new Date()))
  if (landing.kind === 'cycle') {
    redirect(`/${slug}/cycles/${landing.slug}`)
  }
  redirect(`/${slug}/cycles`)
}
