'use client'

import { packLanes } from '@/lib/calendar/lane-packing'
import type { PositionedBand } from '@/lib/calendar/overlay-positioning'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Hit-area height per lane; the visible mark inside is a 3px hairline, leaving
// ~9px of breathing room between stacked lanes.
const LANE_HEIGHT = 12

const pct = (n: number) => `${Math.min(Math.max(n, 0), 1) * 100}%`

/**
 * A fine FYI row of calendar overlay marks, aligned under a timebox/cycle-window
 * tape. Each Holiday or Time Off is its own 2px hairline (Holidays amber, Time
 * Off sky), lane-stacked so overlapping absences sit as parallel lines rather
 * than burying one another — hover any mark to see who is away or what the
 * holiday is. Expects individually-positioned bands (not clustered), so the
 * hover can name a single person.
 */
export function CalendarOverlayRow({
  bands,
  anchor = 'top',
}: {
  bands: PositionedBand[]
  /** Which edge the first lane (Holidays) sticks to — set 'bottom' when the row
   *  sits above the tape so Holidays stay nearest the line. */
  anchor?: 'top' | 'bottom'
}) {
  if (bands.length === 0) return null

  // Holidays take the first lane (location-wide, few, rarely overlap); Time Off
  // lane-stacks after so overlapping absences each stay hoverable. The first
  // lane sits nearest the tape regardless of which side the row is on.
  const holidays = bands.filter((b) => b.kind === 'holiday')
  const timeOff = bands.filter((b) => b.kind === 'timeoff')
  const holidayLanes = holidays.length > 0 ? 1 : 0

  const packedTimeOff = packLanes(timeOff)
  const placed = [
    ...holidays.map((band) => ({ band, lane: 0 })),
    ...packedTimeOff.placed.map(({ band, lane }) => ({ band, lane: lane + holidayLanes })),
  ]
  const laneCount = holidayLanes + packedTimeOff.laneCount

  // Above the tape, lane 0 anchors to the bottom so Holidays hug the line.
  const laneTop = (lane: number) =>
    (anchor === 'bottom' ? laneCount - 1 - lane : lane) * LANE_HEIGHT

  return (
    <TooltipProvider delayDuration={80}>
      <div className="relative w-full" style={{ height: laneCount * LANE_HEIGHT }}>
        {placed.map(({ band, lane }, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className="absolute flex items-center justify-center"
                style={{
                  left: pct(band.leftFraction),
                  width: `max(2px, ${pct(band.widthFraction)})`,
                  top: laneTop(lane),
                  height: LANE_HEIGHT,
                }}
              >
                <div
                  className={`h-[3px] rounded-full ${
                    band.kind === 'holiday' ? 'bg-amber-500' : 'bg-sky-500'
                  }`}
                  // Inset a little so adjacent marks read as separate, not one bar.
                  style={{ width: 'max(2px, calc(100% - 4px))' }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <span className="font-medium">{band.summary}</span>
              <span className="text-muted-foreground"> · {band.label}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
