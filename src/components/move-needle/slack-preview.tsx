'use client'

import type { Zone } from '@/cycle-liveblocks.config'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import { needleProgressNote } from '@/lib/slack-message'

const ZONE_LABEL: Record<Zone, string> = {
  on_track: 'On track',
  some_risk: 'Some risk',
  concerned: 'Concerned',
}

function ZoneDot({ zone }: { zone: Zone }) {
  return (
    <span
      className="w-2 h-2 rounded-full inline-block"
      style={{ backgroundColor: ZONE_COLORS[zone] }}
    />
  )
}

export type SlackPreviewProps = {
  pitchTitle: string
  weekLabel: string
  zone: Zone | null
  previousZone?: Zone | null
  narrative: string
  movement?: string | null
  needleProgress?: number
  previousNeedleProgress?: number | null
  authorName: string
  daysLeft: number
}

export function SlackPreview({
  pitchTitle,
  weekLabel,
  zone,
  previousZone = null,
  narrative,
  movement = null,
  needleProgress,
  previousNeedleProgress = null,
  authorName,
  daysLeft,
}: SlackPreviewProps) {
  // Mirror the Block Kit zone line: a neutral transition when the zone changed,
  // a flat label otherwise. Direction is never styled as good or bad.
  const changed = zone !== null && previousZone !== null && previousZone !== zone
  const needleNote =
    needleProgress === undefined
      ? null
      : needleProgressNote(previousNeedleProgress, needleProgress)

  return (
    <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
      <div className="text-[10px] font-mono text-muted-foreground">
        Slack preview
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="font-semibold">📌 {pitchTitle}</div>

        {zone && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            {changed && previousZone ? (
              <>
                <ZoneDot zone={previousZone} />
                <span className="text-muted-foreground">→</span>
                <ZoneDot zone={zone} />
                <span style={{ color: ZONE_COLORS[zone] }}>
                  Now {ZONE_LABEL[zone].toLowerCase()}
                </span>
                <span className="text-muted-foreground">
                  (was {ZONE_LABEL[previousZone].toLowerCase()})
                </span>
              </>
            ) : (
              <>
                <ZoneDot zone={zone} />
                <span style={{ color: ZONE_COLORS[zone] }}>{ZONE_LABEL[zone]}</span>
              </>
            )}
          </div>
        )}

        {needleNote && (
          <div className="text-[11px] font-medium">{needleNote}</div>
        )}

        {narrative ? (
          <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed border-l-2 border-border pl-2">
            {narrative}
          </p>
        ) : (
          <p className="text-muted-foreground/40 italic">
            Narrative is optional — add a note or just post the needle.
          </p>
        )}

        {movement && (
          <div className="text-[10px] text-muted-foreground whitespace-pre-line leading-relaxed">
            {movement}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
          {authorName} · {weekLabel} · {daysLeft} days left · View pitch →
        </div>
      </div>
    </div>
  )
}
