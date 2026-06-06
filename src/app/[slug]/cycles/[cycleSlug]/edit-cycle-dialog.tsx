'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border hover:bg-muted transition-colors">
          <Pencil className="w-3 h-3" />
          Edit cycle
        </button>
      </DialogTrigger>
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
  )
}
