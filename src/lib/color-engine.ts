// Pure colour logic for Scope Color (see ADR 0008). No React, no storage.

// Twelve curated, mutually-distinct hues, each legible as a dot on both light
// and dark card backgrounds. The number drawn on top uses readableTextColor.
export const SCOPE_PALETTE = [
  '#e5484d', // red
  '#f76b15', // orange
  '#ffb224', // amber
  '#99d52a', // lime
  '#30a46c', // green
  '#12a594', // teal
  '#00a2c7', // cyan
  '#3e63dd', // blue
  '#6e56cf', // indigo
  '#8e4ec6', // purple
  '#e93d82', // pink
  '#ad7f58', // brown
]


/** Parse a #rrggbb hex into [r, g, b] components in 0..255. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Hue of a color in degrees, 0..360. */
function hueOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

/** Smallest angular distance between two hues, 0..180. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** Convert HSL (h in degrees, s/l in 0..1) to a #rrggbb hex. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = (
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]
  ).map((v) => Math.round((v + m) * 255))
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * A new color sitting in the widest empty hue gap among the used hues, at a
 * fixed saturation/lightness band tuned to stay legible on both themes. Used
 * only once the curated palette is exhausted — guarantees no duplication.
 */
function generateHueGapColor(usedColors: string[]): string {
  const hues = usedColors.map(hueOf).sort((a, b) => a - b)
  let gapStart = hues[hues.length - 1]
  let gapSize = 360 - hues[hues.length - 1] + hues[0]
  for (let i = 1; i < hues.length; i++) {
    const size = hues[i] - hues[i - 1]
    if (size > gapSize) {
      gapSize = size
      gapStart = hues[i - 1]
    }
  }
  const newHue = (gapStart + gapSize / 2) % 360
  return hslToHex(newHue, 0.65, 0.5)
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** A near-black or near-white that stays legible as the badge number on `hex`. */
export function readableTextColor(hex: string): string {
  return relativeLuminance(hex) > 0.4 ? '#0a0a0a' : '#ffffff'
}

/**
 * Pick a unique identity color for a new scope, given the colors already used
 * by its sibling scopes. Deterministic — no randomness — so assignment is
 * replay-safe and testable.
 */
export function assignScopeColor(usedColors: string[]): string {
  const unused = SCOPE_PALETTE.filter((c) => !usedColors.includes(c))
  if (unused.length === 0) return generateHueGapColor(usedColors)
  if (usedColors.length === 0) return unused[0]

  // Among unused palette colors, pick the one whose hue is most distant from
  // every used hue (maximize the minimum distance). Palette order breaks ties,
  // keeping the choice deterministic.
  const usedHues = usedColors.map(hueOf)
  let best = unused[0]
  let bestScore = -1
  for (const candidate of unused) {
    const h = hueOf(candidate)
    const score = Math.min(...usedHues.map((u) => hueDistance(h, u)))
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

/**
 * Resolve a display color for every scope: stored colors are honored as-is;
 * unset ones are filled with a unique color that doesn't collide with siblings.
 * Assignment walks scopes in stable id-order (not build order) so a scope keeps
 * its color when scopes are reordered. Returns id → color.
 */
export function resolveScopeColors(
  scopes: Array<{ id: string; color?: string }>
): Record<string, string> {
  const ordered = [...scopes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const used: string[] = []
  const result: Record<string, string> = {}
  for (const scope of ordered) {
    const color = scope.color ?? assignScopeColor(used)
    result[scope.id] = color
    used.push(color)
  }
  return result
}
