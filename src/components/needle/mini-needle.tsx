'use client'

import type { Needle } from '@/cycle-liveblocks.config'
import {
  type ArcConfig,
  arcPoint,
  arcPath,
  arcLength,
  fillLength,
} from './needle-geometry'
import { ZONE_COLORS, NULL_COLOR } from './zone-colors'
import { useAnimatedProgress } from './use-animated-progress'

const WIDTH = 48
const HEIGHT = 28
const ARC: ArcConfig = { cx: 24, cy: 56, r: 40, sweepDeg: 64 }

type MiniNeedleProps = {
  needle: Needle | null
  delay?: number
}

export function MiniNeedle({ needle, delay = 0 }: MiniNeedleProps) {
  const color = needle ? ZONE_COLORS[needle.zone] : NULL_COLOR
  const progress = useAnimatedProgress(needle?.progress ?? 0, delay * 1000)
  const tipPoint = arcPoint(ARC, progress)
  const arcD = arcPath(ARC)
  const totalLength = arcLength(ARC)
  const fillLen = fillLength(ARC, progress)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}>
      <path
        d={arcD}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        opacity={0.15}
        strokeLinecap="round"
      />

      {needle && (
        <>
          <path
            d={arcD}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${totalLength}`}
          />
          <circle cx={tipPoint.x} cy={tipPoint.y} r={3} fill={color} />
        </>
      )}
    </svg>
  )
}
