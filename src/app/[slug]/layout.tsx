import {
  OrganizationSwitcher,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ThemeSelector } from '@/components/theme-selector'
import { MarkGithubIcon } from '@primer/octicons-react'
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
          <Link
            href="/"
            className="font-display text-lg transition-colors hover:text-foreground/70"
          >
            Cycles
          </Link>
          <div className="flex items-center gap-1.5">
            <SignedOut>
              <SignInButton>
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <CommandSearchButton />
              <div className="flex items-center [&_.cl-organizationPreviewMainIdentifier]:text-foreground">
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
              <div className="flex size-7 items-center justify-center">
                <UserButton />
              </div>
            </SignedIn>
            <ThemeSelector />
            <Button variant="ghost" size="icon" asChild>
              <a href="https://github.com/vascohq/cycles" target="_blank">
                <MarkGithubIcon className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {children}
    </CommandPaletteProvider>
  )
}
