'use client'

import { useState } from 'react'
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { createCycleRoom } from '@/app/[slug]/cycles/actions'

function toSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateCycleForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <form className="flex flex-col gap-4" action={createCycleRoom}>
      <DialogHeader>
        <DialogTitle>Create a new cycle</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <Label htmlFor="name">Cycle name</Label>
          <Input
            type="text"
            placeholder="Build Cycle 1"
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
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
            placeholder="build-cycle-1"
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

        <section className="flex flex-col gap-2">
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue="build">
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
            <Input type="date" id="start_date" name="start_date" required />
          </section>
          <section className="flex flex-col gap-2">
            <Label htmlFor="end_date">End date</Label>
            <Input type="date" id="end_date" name="end_date" required />
          </section>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  )
}
