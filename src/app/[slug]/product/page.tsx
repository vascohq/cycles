import type { Metadata } from 'next'
import { ProductMap } from './product-map'
import { loadProduct } from './load-product'

export const metadata: Metadata = {
  title: 'Product Map | Cycles',
}

export default async function ProductMapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProductMap {...await loadProduct(slug, '')} />
}
