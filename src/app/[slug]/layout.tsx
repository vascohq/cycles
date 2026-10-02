import { OrganizationSwitcher, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { UserMenu } from '@/components/user-menu'
import { CommandPaletteProvider } from '@/components/command-palette/command-palette-context'
import { CommandSearchButton } from '@/components/command-palette/command-search-button'
import { AppSidebar } from '@/components/app-sidebar'
import { UiPrefsProvider } from '@/components/ui-prefs'
import { UI_PREF_COOKIES } from '@/lib/ui-pref-cookies'
import { cookies } from 'next/headers'

export default async function OrgLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ slug: string }>
}>) {
  const { slug } = await params
  // Read here so the server renders the sidebar and the frame list as the
  // viewer left them, with no flicker after load.
  const jar = await cookies()
  const prefs = {
    sidebarClosed: jar.get(UI_PREF_COOKIES.sidebarClosed)?.value === '1',
    framesHidden: jar.get(UI_PREF_COOKIES.framesHidden)?.value === '1',
  }
  return (
    <CommandPaletteProvider slug={slug}>
      <UiPrefsProvider initial={prefs}>
        {/* Plane-style shell: a gray canvas holds the top bar and the sidebar;
          the page itself sits on a white, bordered panel. */}
        <div className="flex h-[100dvh] flex-col bg-canvas">
          <header className="grid h-12 shrink-0 grid-cols-[1fr_minmax(0,32rem)_1fr] items-center gap-3 px-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/${slug}/cycles`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-semibold transition-colors hover:bg-foreground/5"
              >
                {/* Theme-aware logo: dark-on-light in light mode, light-on-dark in
                  dark mode. Swapped via the `dark` class (no flash). */}
                <Image
                  src="/web-app-manifest-512x512.png"
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 dark:hidden"
                />
                <Image
                  src="/web-app-manifest-512x512-light.png"
                  alt=""
                  width={20}
                  height={20}
                  className="hidden size-5 dark:block"
                />
                Cycles
              </Link>
              <SignedIn>
                <span className="text-border" aria-hidden>
                  /
                </span>
                {/* -ml-2 cancels the Clerk trigger's 8px left padding so the gaps
                  on either side of the "/" read as equal. */}
                <div className="flex items-center -ml-2 [&_.cl-organizationPreviewMainIdentifier]:text-foreground">
                  <OrganizationSwitcher
                    afterSelectOrganizationUrl="/:slug/cycles"
                    afterSelectPersonalUrl="/me/cycles"
                    appearance={{
                      elements: {
                        organizationSwitcherPopoverActionButton__createOrganization: {
                          display: 'none',
                        },
                      },
                    }}
                  />
                </div>
              </SignedIn>
            </div>
            <div className="flex justify-center">
              <SignedIn>
                <CommandSearchButton />
              </SignedIn>
            </div>
            <div className="flex items-center justify-end gap-3">
              <SignedOut>
                <SignInButton>
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserMenu slug={slug} />
              </SignedIn>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <SignedIn>
              <AppSidebar />
            </SignedIn>
            {/* Each section's layout fills this panel with its own sidebar and
              a scrolling page (see SidebarLayout). */}
            <div className="mb-2 mr-2 flex min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm max-md:ml-2">
              {children}
            </div>
          </div>
        </div>
      </UiPrefsProvider>
    </CommandPaletteProvider>
  )
}
