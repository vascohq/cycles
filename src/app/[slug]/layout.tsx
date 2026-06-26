import {
  OrganizationSwitcher,
  SignInButton,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { UserMenu } from '@/components/user-menu'
import { CommandPaletteProvider } from '@/components/command-palette/command-palette-context'
import { CommandSearchButton } from '@/components/command-palette/command-search-button'

export default async function OrgLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ slug: string }>
}>) {
  const { slug } = await params
  return (
    <CommandPaletteProvider slug={slug}>
      <header className="sticky top-0 z-40 h-16 border-b bg-background">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}/cycles`}
              className="flex items-center gap-2 font-display text-lg transition-colors hover:text-foreground/70"
            >
              {/* Theme-aware logo: dark-on-light in light mode, light-on-dark in
                  dark mode. Swapped via the `dark` class (no flash). */}
              <Image
                src="/web-app-manifest-512x512.png"
                alt=""
                width={24}
                height={24}
                className="size-6 dark:hidden"
              />
              <Image
                src="/web-app-manifest-512x512-light.png"
                alt=""
                width={24}
                height={24}
                className="hidden size-6 dark:block"
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
                      organizationSwitcherPopoverActionButton__createOrganization:
                        { display: 'none' },
                    },
                  }}
                />
              </div>
            </SignedIn>
          </div>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton>
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <CommandSearchButton />
              <UserMenu slug={slug} />
            </SignedIn>
          </div>
        </div>
      </header>

      {children}
    </CommandPaletteProvider>
  )
}
