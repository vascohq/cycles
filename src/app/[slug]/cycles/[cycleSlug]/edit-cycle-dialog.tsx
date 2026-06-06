'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCycleRoom } from '@/app/[slug]/cycles/actions'

export type EditCycleButtonProps = {
  cycleSlug: string
  name: string
  type: 'build' | 'cooldown'
  start_date: string
  end_date: string
}

export function EditCycleButton({
  cycleSlug,
  name,
  type,
  start_date,
  end_date,
}: EditCycleButtonProps) {
  const [open, setOpen] = useState(false)

  async function handleSubmit(formData: FormData) {
    await updateCycleRoom(cycleSlug, formData)
    setOpen(false)
  }

  return (
    <>
      {/* Same "..." overflow menu as the scope box, even with one action. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Cycle actions"
            className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Edit cycle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <form className="flex flex-col gap-4" action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit cycle</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <Label htmlFor="name">Cycle name</Label>
              <Input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={name}
              />
            </section>

            <section className="flex flex-col gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={cycleSlug} readOnly disabled />
              <p className="text-muted-foreground text-xs">
                The slug is the cycle&apos;s permanent address and can&apos;t be
                changed.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">Build (6 weeks)</SelectItem>
                  <SelectItem value="cooldown">Cooldown (2 weeks)</SelectItem>
                </SelectContent>
              </Select>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <section className="flex flex-col gap-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  type="date"
                  id="start_date"
                  name="start_date"
                  required
                  defaultValue={start_date}
                />
              </section>
              <section className="flex flex-col gap-2">
                <Label htmlFor="end_date">End date</Label>
                <Input
                  type="date"
                  id="end_date"
                  name="end_date"
                  required
                  defaultValue={end_date}
                />
              </section>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
