'use client'

import { useState } from 'react'
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createRoom } from '@/app/boards/actions'

export function toSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateBoardForm() {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <form className="flex flex-col gap-4" action={createRoom}>
      <DialogHeader>
        <DialogTitle>Create a new board</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <Label htmlFor="title">Board title</Label>
          <Input
            type="text"
            placeholder="My awesome board"
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slugTouched) {
                setSlug(toSlug(e.target.value))
              }
            }}
          />
        </section>
        <section className="flex flex-col gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            type="text"
            placeholder="my-awesome-board"
            id="slug"
            name="slug"
            required
            minLength={5}
            pattern="[a-z0-9\-]*"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugTouched(true)
            }}
          />
          <p className="text-muted-foreground text-xs">
            Must contain only lowercase letters, digits, and dashes.
          </p>
        </section>
      </div>

      <DialogFooter>
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  )
}
