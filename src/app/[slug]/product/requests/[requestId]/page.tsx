import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadProduct } from '../../load-product'
import { RequestPage } from './request-page'

export const metadata: Metadata = {
  title: 'Request | Cycles',
}

// The same rule as every slug in the app: no slashes, dots or encoded
// characters, so the id can never turn the workspace redirect in loadProduct
// into a link to somewhere else.
const REQUEST_ID = /^[a-zA-Z0-9_-]+$/

export default async function RequestRoute({
  params,
}: {
  params: Promise<{ slug: string; requestId: string }>
}) {
  const { slug, requestId } = await params
  if (!REQUEST_ID.test(requestId)) notFound()

  return <RequestPage requestId={requestId} {...await loadProduct(slug, `/requests/${requestId}`)} />
}
