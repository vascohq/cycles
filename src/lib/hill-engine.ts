const WIDTH = 400
const HEIGHT = 100
const BASELINE_Y = 90
const PEAK_Y = 10
const SAMPLES = 300

function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function hillPoint(t: number): { x: number; y: number } {
  if (t <= 0.5) {
    const lt = t * 2
    return {
      x: cubicBezier(lt, 0, 0, WIDTH * 0.35, WIDTH * 0.5),
      y: cubicBezier(lt, BASELINE_Y, BASELINE_Y, PEAK_Y, PEAK_Y),
    }
  }
  const rt = (t - 0.5) * 2
  return {
    x: cubicBezier(rt, WIDTH * 0.5, WIDTH * 0.65, WIDTH, WIDTH),
    y: cubicBezier(rt, PEAK_Y, PEAK_Y, BASELINE_Y, BASELINE_Y),
  }
}

// Sample the curve, then tag each sample with its cumulative arc-length
// fraction `s`. Reparameterizing by `s` makes equal progress steps equal
// DISTANCE along the hill (the raw Bézier parameter bunches points near the
// foot and stretches them near the crest). The curve shape is unchanged.
const sampledPoints = (() => {
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES
    return { t, ...hillPoint(t) }
  })
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const total = cum[cum.length - 1] || 1
  return pts.map((p, i) => ({ ...p, s: cum[i] / total }))
})()

// `progress` is an arc-length fraction (0..1): the point that far ALONG the hill.
export function progressToPoint(progress: number): { x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress))
  let best = sampledPoints[0]
  let bestDist = Math.abs(best.s - p)
  for (const sp of sampledPoints) {
    const dist = Math.abs(sp.s - p)
    if (dist < bestDist) {
      bestDist = dist
      best = sp
    }
  }
  return { x: best.x, y: best.y }
}

export function pointToProgress(x: number): number {
  let best = sampledPoints[0]
  let bestDist = Math.abs(x - best.x)
  for (const sp of sampledPoints) {
    const dist = Math.abs(x - sp.x)
    if (dist < bestDist) {
      bestDist = dist
      best = sp
    }
  }
  return best.s
}

export function clampHillProgress(progress: number): number {
  return Math.min(0.98, Math.max(0.02, progress))
}

export { WIDTH, HEIGHT, BASELINE_Y, PEAK_Y }
