import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadProduct } from '../../load-product'
import { AreaPage } from './area-page'

export const metadata: Metadata = {
  title: 'Area | Cycles',
}

// The same rule as every slug in the app: no slashes, dots or encoded
// characters, so the id can never turn the workspace redirect in loadProduct
// into a link to somewhere else.
const AREA_ID = /^[a-zA-Z0-9_-]+$/

export default async function AreaRoute({
  params,
}: {
  params: Promise<{ slug: string; areaId: string }>
}) {
  const { slug, areaId } = await params
  if (!AREA_ID.test(areaId)) notFound()

  return <AreaPage areaId={areaId} {...await loadProduct(slug, `/areas/${areaId}`)} />
}
