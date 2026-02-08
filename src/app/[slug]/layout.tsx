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

export default function OrgLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 px-2 border-b h-10 flex items-center justify-between bg-background z-10">
        <h1 className="font-bold">Cycles</h1>
        <div className="flex items-center gap-2">
          <SignedOut>
            <SignInButton>
              <Button variant="link">Sign in</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex gap-2">
              <Button variant="link" asChild>
                <Link href="/">Boards</Link>
              </Button>
              <div className="flex items-center [&_.cl-organizationPreviewMainIdentifier]:text-foreground">
                <OrganizationSwitcher
                  afterSelectOrganizationUrl="/:slug/boards"
                  afterSelectPersonalUrl="/me/boards"
                  appearance={{
                    elements: {
                      organizationSwitcherPopoverActionButton__createOrganization:
                        { display: 'none' },
                    },
                  }}
                />
              </div>
              <div className="flex items-center size-6 self-center">
                <UserButton />
              </div>
            </div>
          </SignedIn>
          <ThemeSelector />
          <Button variant="ghost" size="icon" className="-ml-2" asChild>
            <a href="https://github.com/scastiel/cycles" target="_blank">
              <MarkGithubIcon className="size-4" />
            </a>
          </Button>
        </div>
      </header>

      {children}
    </>
  )
}
