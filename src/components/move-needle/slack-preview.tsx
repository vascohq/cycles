'use client'

import type { Zone } from '@/cycle-liveblocks.config'
import { ZONE_COLORS } from '@/components/needle/zone-colors'

const ZONE_LABEL: Record<Zone, string> = {
  on_track: 'On track',
  some_risk: 'Some risk',
  concerned: 'Concerned',
}

export type SlackPreviewProps = {
  pitchTitle: string
  weekLabel: string
  zone: Zone | null
  narrative: string
  tasksDone: number
  tasksTotal: number
  daysLeft: number
}

export function SlackPreview({
  pitchTitle,
  weekLabel,
  zone,
  narrative,
  tasksDone,
  tasksTotal,
  daysLeft,
}: SlackPreviewProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
      <div className="text-[10px] font-mono text-muted-foreground">
        Slack preview
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="font-semibold">
          📌 {pitchTitle} · {weekLabel}
        </div>

        {zone && (
          <span
            className="inline-flex items-center gap-1.5 w-fit rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: ZONE_COLORS[zone] + '20',
              color: ZONE_COLORS[zone],
              border: `1px solid ${ZONE_COLORS[zone]}40`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: ZONE_COLORS[zone] }}
            />
            {ZONE_LABEL[zone]}
          </span>
        )}

        {narrative ? (
          <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
            {narrative}
          </p>
        ) : (
          <p className="text-muted-foreground/40 italic">
            Your update will appear here…
          </p>
        )}

        <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
          {tasksDone}/{tasksTotal} tasks done · {daysLeft} days left · View pitch →
        </div>
      </div>
    </div>
  )
}
