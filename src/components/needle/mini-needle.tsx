'use client'

import type { Needle } from '@/cycle-liveblocks.config'
import { ZONE_COLORS, NULL_COLOR } from './zone-colors'

const WIDTH = 48
const HEIGHT = 28
const CX = 24
const CY = 26
const RX = 20
const RY = 18

const round = (n: number) => Math.round(n * 1000) / 1000

function arcPoint(t: number) {
  const angle = Math.PI + t * Math.PI
  return {
    x: round(CX + RX * Math.cos(angle)),
    y: round(CY + RY * Math.sin(angle)),
  }
}

function arcPath() {
  const start = arcPoint(0)
  const end = arcPoint(1)
  return `M ${start.x} ${start.y} A ${RX} ${RY} 0 0 1 ${end.x} ${end.y}`
}

type MiniNeedleProps = {
  needle: Needle | null
}

export function MiniNeedle({ needle }: MiniNeedleProps) {
  const color = needle ? ZONE_COLORS[needle.zone] : NULL_COLOR
  const progress = needle?.progress ?? 0
  const tipPoint = arcPoint(progress)
  const arcD = arcPath()
  const totalLength = round(Math.PI * Math.sqrt((RX * RX + RY * RY) / 2))
  const fillLength = round(progress * totalLength)

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
            strokeDasharray={`${fillLength} ${totalLength}`}
          />
          <circle cx={tipPoint.x} cy={tipPoint.y} r={3} fill={color} />
        </>
      )}
    </svg>
  )
}
