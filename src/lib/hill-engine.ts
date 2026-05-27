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

const sampledPoints = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const t = i / SAMPLES
  return { t, ...hillPoint(t) }
})

export function progressToPoint(progress: number): { x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress))
  const pt = hillPoint(p)
  return { x: pt.x, y: pt.y }
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
  return best.t
}

export function clampHillProgress(progress: number): number {
  return Math.min(0.98, Math.max(0.02, progress))
}

export { WIDTH, HEIGHT, BASELINE_Y, PEAK_Y }
