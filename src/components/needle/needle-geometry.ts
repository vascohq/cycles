import { clampProgress } from '@/lib/needle-engine'

// A shallow circular arc, high in the middle, used for the needle gauge.
// (cx, cy) is the circle center, which sits *below* the visible arc.
// `r` is the radius; `sweepDeg` is the total angular span the arc occupies,
// centered on straight-up. Position t in [0,1] runs left -> right.
export type ArcConfig = {
  cx: number
  cy: number
  r: number
  sweepDeg: number
}

const round = (n: number) => Math.round(n * 1000) / 1000
const toRad = (deg: number) => (deg * Math.PI) / 180

// Angle (radians) from straight-up at parameter t, clockwise positive.
function angleAt(config: ArcConfig, t: number) {
  return (t - 0.5) * toRad(config.sweepDeg)
}

export function arcPoint(config: ArcConfig, t: number) {
  const a = angleAt(config, t)
  return {
    x: round(config.cx + config.r * Math.sin(a)),
    y: round(config.cy - config.r * Math.cos(a)),
  }
}

export function arcPath(config: ArcConfig) {
  const start = arcPoint(config, 0)
  const end = arcPoint(config, 1)
  return `M ${start.x} ${start.y} A ${config.r} ${config.r} 0 0 1 ${end.x} ${end.y}`
}

export function arcLength(config: ArcConfig) {
  return round(config.r * toRad(config.sweepDeg))
}

export function fillLength(config: ArcConfig, progress: number) {
  return round(progress * arcLength(config))
}

// Tilt of the handle from vertical (degrees) at parameter t. Linear across the
// arc, so the handle leans gently and symmetrically — never flops sideways.
export function tangentTiltDeg(config: ArcConfig, t: number) {
  return round((t - 0.5) * config.sweepDeg)
}

// Inverse of arcPoint: nearest position on the arc to a point, clamped.
export function progressFromPoint(config: ArcConfig, x: number, y: number) {
  const a = Math.atan2(x - config.cx, config.cy - y)
  return clampProgress(0.5 + a / toRad(config.sweepDeg))
}
