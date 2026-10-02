/** Where a frame lives. Every way into a frame opens its page, which has a URL. */
export function frameHref(slug: string, frameId: string): string {
  return `/${slug}/product/frames/${frameId}`
}

/** The id an area page takes for the frames that belong to no area. */
export const UNMAPPED_AREA = 'unmapped'

/** Where an area lives. The breadcrumb on a frame page links here. */
export function areaHref(slug: string, areaId: string): string {
  return `/${slug}/product/areas/${areaId}`
}
