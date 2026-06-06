'use client'

import { UserButton } from '@clerk/nextjs'
import { Settings, SunMoon } from 'lucide-react'
import { useTheme } from 'next-themes'

/**
 * The avatar dropdown — a single GitHub-style menu holding app actions
 * (Integrations, light/dark) alongside Clerk's own manage-account and sign-out.
 * Built on Clerk's <UserButton.MenuItems> so the account actions stay native.
 */
export function UserMenu({ slug }: { slug: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Integrations"
          labelIcon={<Settings className="size-4" />}
          href={`/${slug}/settings/integrations`}
        />
        <UserButton.Action
          label={nextTheme === 'dark' ? 'Dark mode' : 'Light mode'}
          labelIcon={<SunMoon className="size-4" />}
          onClick={() => setTheme(nextTheme)}
        />
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  )
}
