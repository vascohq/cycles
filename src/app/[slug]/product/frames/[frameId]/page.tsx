import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadProduct } from '../../load-product'
import { FramePage } from './frame-page'

export const metadata: Metadata = {
  title: 'Frame | Cycles',
}

// The same rule as every slug in the app: no slashes, dots or encoded
// characters, so the id can never turn the workspace redirect in loadProduct
// into a link to somewhere else.
const FRAME_ID = /^[a-zA-Z0-9_-]+$/

export default async function FrameRoute({
  params,
}: {
  params: Promise<{ slug: string; frameId: string }>
}) {
  const { slug, frameId } = await params
  if (!FRAME_ID.test(frameId)) notFound()

  return <FramePage frameId={frameId} {...await loadProduct(slug, `/frames/${frameId}`)} />
}
