'use client'

import { CircleHelp } from 'lucide-react'

export type ParkingLotItem = {
  id: string
  text: string
  resolved: boolean
}

type ParkingLotProps = {
  items: ParkingLotItem[]
  onToggleResolved?: (itemId: string, resolved: boolean) => void
  readOnly?: boolean
}

export function ParkingLot({ items, onToggleResolved, readOnly }: ParkingLotProps) {
  // Hide the whole section when there's nothing parked — no empty state.
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-foreground/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CircleHelp className="w-4 h-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold leading-tight tracking-tight">
            Parking lot
          </h3>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            decisions before build · not a scope
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => {
            const Tag = readOnly ? 'div' : 'button'
            return (
              <Tag
                key={item.id}
                {...(!readOnly && { type: 'button' as const, onClick: () => onToggleResolved?.(item.id, !item.resolved) })}
                className={`flex items-start gap-2 text-xs text-left py-1 ${readOnly ? '' : 'group'}`}
              >
                <span className="flex-shrink-0 text-muted-foreground/40 font-bold">
                  ?
                </span>
                <span
                  className={
                    item.resolved
                      ? 'line-through text-muted-foreground/40'
                      : readOnly
                        ? 'text-foreground'
                        : 'text-foreground group-hover:text-foreground/80'
                  }
                >
                  {item.text}
                </span>
              </Tag>
            )
          })}
      </div>
    </div>
  )
}
