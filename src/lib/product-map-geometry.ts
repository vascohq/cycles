/**
 * Geometry for the Product Map's land. Pure functions, no React, no clock.
 *
 * An **Area** is the only thing anyone draws: a closed ring of points an agent
 * can write. An **Island** and an **Archipelago** are never drawn — they are the
 * merged silhouette of their children, fused at render time.
 *
 * Points live in one world space, `WORLD` units across, so an agent placing two
 * areas decides how they sit next to each other.
 */

export const WORLD = 1000

export type Point = [number, number]
export type Ring = Point[]

/** A closed ring through `points`, smoothed so a handful of numbers reads as coastline. */
export function smoothPath(points: Ring): string {
  if (points.length === 0) return ''
  if (points.length < 3) {
    return `M ${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')}`
  }

  const n = points.length
  let d = `M ${round(points[0][0])} ${round(points[0][1])}`
  // Catmull-Rom through every point, converted to cubic Béziers. The /6 is the
  // standard uniform tension: tighter reads as a polygon, looser self-intersects.
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2[0])} ${round(p2[1])}`
  }
  return `${d} Z`
}

export type Bounds = { x: number; y: number; width: number; height: number }

/** The tightest box holding every point. An empty input has no box. */
export function ringBounds(points: Ring): Bounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** The box holding every one of `boxes`. Used to fit the whole map on screen. */
export function unionBounds(boxes: Bounds[]): Bounds | null {
  const corners: Ring = []
  for (const b of boxes) {
    corners.push([b.x, b.y], [b.x + b.width, b.y + b.height])
  }
  return ringBounds(corners)
}

/**
 * The ring's area-weighted centroid — where a label sits. Falls back to the
 * bounding-box centre for a degenerate ring, which a mean of the points does not:
 * a coastline with ten points bunched on one side would drag the label off.
 */
export function centroid(points: Ring): Point {
  const n = points.length
  if (n === 0) return [0, 0]
  if (n < 3) return [points[0][0], points[0][1]]

  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % n]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (twiceArea === 0) {
    const b = ringBounds(points)!
    return [b.x + b.width / 2, b.y + b.height / 2]
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)]
}

/** Ray casting. A point exactly on an edge counts as inside. */
export function inRing([px, py]: Point, points: Ring): boolean {
  if (points.length < 3) return false
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    const straddles = yi > py !== yj > py
    if (straddles && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** FNV-1a. A frame id in, a stable 32-bit number out. */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Where one frame's pin sits inside its area. Derived from the frame id ALONE, so
 * a pin lands on the same spot forever and capturing a frame never moves the
 * others. That promise is worth more here than even spacing.
 *
 * ponytail: rejection sampling, so two pins can land on top of each other. The
 * halos are translucent, so a collision reads as heat rather than as a bug. If
 * dense areas ever look wrong, relax the points against each other in id order —
 * and accept that pins then shift when a frame arrives.
 */
export function pinPosition(frameId: string, points: Ring): Point {
  const box = ringBounds(points)
  if (!box || points.length < 3) return centroid(points)

  let h = hash(frameId)
  // Inset, so a pin never straddles the coastline it belongs inside.
  const pad = 0.12
  for (let attempt = 0; attempt < 24; attempt++) {
    h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0
    const fx = ((h & 0xffff) / 0xffff) * (1 - 2 * pad) + pad
    const fy = ((h >>> 16) / 0xffff) * (1 - 2 * pad) + pad
    const candidate: Point = [box.x + fx * box.width, box.y + fy * box.height]
    if (inRing(candidate, points)) return candidate
  }
  return centroid(points)
}

/**
 * A closed ring for an area nobody has drawn yet, generated around its grid cell
 * so an area created before this feature still reads as land. The wobble is
 * seeded from the id, so the same area generates the same coastline every time.
 */
export function generateRing(seed: string, cx: number, cy: number, radius: number): Ring {
  const sides = 11
  let h = hash(seed)
  const ring: Ring = []
  for (let i = 0; i < sides; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d) >>> 0
    const jitter = 0.78 + ((h & 0xffff) / 0xffff) * 0.42
    const angle = (i / sides) * Math.PI * 2
    ring.push([cx + Math.cos(angle) * radius * jitter, cy + Math.sin(angle) * radius * jitter])
  }
  return ring
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
