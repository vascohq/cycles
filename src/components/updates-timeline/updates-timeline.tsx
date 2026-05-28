'use client'

import { MiniNeedle } from '@/components/needle/mini-needle'
import { ZONE_COLORS } from '@/components/needle/zone-colors'
import type { TimelineCard } from '@/lib/timeline-helpers'
import { cn } from '@/lib/utils'

export type UpdatesTimelineProps = {
  cards: TimelineCard[]
  channelName: string
}

export function UpdatesTimeline({ cards, channelName }: UpdatesTimelineProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-gloria text-[32px]">Updates</h2>
        <p className="text-xs font-mono text-muted-foreground">
          Posted Tuesdays to #{channelName}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          No updates yet — post the first one when Tuesday rolls around
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => (
            <UpdateCard key={card.id} card={card} isNewest={i === 0} />
          ))}
        </div>
      )}
    </section>
  )
}

function UpdateCard({
  card,
  isNewest,
}: {
  card: TimelineCard
  isNewest: boolean
}) {
  const zoneLabel = card.needleSnapshot.zone.replace('_', ' ')
  const zoneColor = ZONE_COLORS[card.needleSnapshot.zone]

  return (
    <div
      className={cn(
        'grid gap-3 rounded-xl border bg-card p-4',
        isNewest && 'animate-in fade-in slide-in-from-bottom-1'
      )}
      style={{ gridTemplateColumns: '42px 1fr' }}
    >
      <div
        className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0"
        style={{ border: '1.5px solid hsl(var(--foreground))' }}
      >
        <span className="font-gloria text-sm">{card.authorInitials}</span>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{card.authorName}</span>
          <span className="text-xs font-mono text-muted-foreground">
            {card.formattedTimestamp}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <MiniNeedle needle={card.needleSnapshot} />
          <span
            className="text-xs font-gloria"
            style={{ color: zoneColor }}
          >
            {zoneLabel.charAt(0).toUpperCase() + zoneLabel.slice(1)}
          </span>
          {card.scopesMoved > 0 && (
            <span className="text-xs font-mono text-muted-foreground">
              {card.scopesMoved} scope{card.scopesMoved !== 1 ? 's' : ''} moved
            </span>
          )}
        </div>

        <p className="text-[13.5px] leading-relaxed">{card.narrative}</p>
      </div>
    </div>
  )
}
