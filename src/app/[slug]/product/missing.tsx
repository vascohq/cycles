'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

/** A frame or an area page whose id names nothing in the room. */
export function Missing({ what }: { what: 'frame' | 'area' }) {
  const { slug } = useParams<{ slug: string }>()
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
      <p className="font-display text-xl">No {what} here</p>
      <p className="text-sm text-muted-foreground">It was deleted, or the link is wrong.</p>
      <Link href={`/${slug}/product`} className="text-sm underline">
        Back to the Product Map
      </Link>
    </main>
  )
}
