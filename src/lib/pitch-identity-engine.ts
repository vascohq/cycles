const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

export function normalizeEmoji(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const graphemes = [...graphemeSegmenter.segment(trimmed)]
  if (graphemes.length !== 1) return ''
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return ''
  return trimmed
}

export type NotionUrlValidation = {
  value: string
  isValidUrl: boolean
  isNotionHost: boolean
}

export function validateNotionUrl(input: string): NotionUrlValidation {
  const value = input.trim()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { value, isValidUrl: false, isNotionHost: false }
  }
  const isValidUrl = url.protocol === 'https:'
  const isNotionHost =
    isValidUrl && /(^|\.)notion\.(so|site)$/.test(url.hostname)
  return { value, isValidUrl, isNotionHost }
}
