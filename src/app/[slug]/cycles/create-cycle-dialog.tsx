'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-sm shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="size-4 text-muted-foreground" />
            New cycle
          </button>
        ) : (
          <Button size="sm">Create cycle</Button>
        )}
      </DialogTrigger>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )
}
