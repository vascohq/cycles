import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const authResult = await auth()
  const { userId, orgSlug } = authResult
  if (!userId) return authResult.redirectToSignIn()

  redirect(`/${orgSlug ?? 'me'}/boards`)
}
