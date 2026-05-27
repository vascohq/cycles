'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { PropsWithChildren } from 'react'

export function CreateCycleDialog({ children }: PropsWithChildren) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Create cycle</Button>
      </DialogTrigger>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )
}
