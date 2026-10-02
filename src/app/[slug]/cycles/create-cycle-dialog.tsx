'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarButton } from '@/components/sidebar-layout'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { PropsWithChildren } from 'react'

// The trigger is built here, not passed in: an element handed from a server
// component can still be unresolved when Radix's Slot renders it on the
// server, which leaves the button out of the HTML and breaks hydration.
export function CreateCycleDialog({
  children,
  variant = 'button',
}: PropsWithChildren<{ variant?: 'button' | 'sidebar' }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === 'sidebar' ? (
          <SidebarButton>
            <Plus className="size-4 text-muted-foreground" />
            New cycle
          </SidebarButton>
        ) : (
          <Button size="sm">New cycle</Button>
        )}
      </DialogTrigger>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )
}
