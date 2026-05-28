export type SlugPath =
  | { kind: 'cycle'; cycleSlug: string }
  | { kind: 'pitch'; cycleSlug: string; pitchSlug: string }

const SEGMENT_RE = /^[a-z0-9][a-z0-9_-]*$/

export function parseSlugPath(path: string): SlugPath {
  const trimmed = path.replace(/^\/+|\/+$/g, '')
  if (!trimmed) throw new Error('Slug path must not be empty')

  const segments = trimmed.split('/')
  if (segments.length > 2) {
    throw new Error(`Slug path has too many segments: "${path}"`)
  }

  for (const seg of segments) {
    if (!SEGMENT_RE.test(seg)) {
      throw new Error(`Invalid slug segment: "${seg}"`)
    }
  }

  if (segments.length === 1) {
    return { kind: 'cycle', cycleSlug: segments[0] }
  }
  return { kind: 'pitch', cycleSlug: segments[0], pitchSlug: segments[1] }
}
