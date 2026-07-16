'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Archive, ArchiveRestore } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DialogDescription } from '@/components/ui/dialog'
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
import { updateCycleRoom, setCycleArchived } from '@/app/[slug]/cycles/actions'

export type EditCycleButtonProps = {
  cycleSlug: string
  name: string
  type: 'build' | 'cooldown'
  start_date: string
  end_date: string
  archived?: boolean
}

export function EditCycleButton({
  cycleSlug,
  name,
  type,
  start_date,
  end_date,
  archived = false,
}: EditCycleButtonProps) {
  const [open, setOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  async function handleSubmit(formData: FormData) {
    await updateCycleRoom(cycleSlug, formData)
    setOpen(false)
  }

  return (
    <>
      {/* Same "..." overflow menu as the scope box. */}
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
          {archived ? (
            <DropdownMenuItem onClick={() => setCycleArchived(cycleSlug, false)}>
              <ArchiveRestore className="w-3.5 h-3.5 mr-2" />
              Unarchive cycle
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
              <Archive className="w-3.5 h-3.5 mr-2" />
              Archive cycle
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reversible, so a plain confirm — no destructive-red styling (ADR 0019). */}
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this cycle?</DialogTitle>
            <DialogDescription>
              It leaves the Cycles list and stops being a landing target. Nothing
              is deleted — you can unarchive it anytime from the Cycles list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await setCycleArchived(cycleSlug, true)
                setConfirmArchive(false)
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
