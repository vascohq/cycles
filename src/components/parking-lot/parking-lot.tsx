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
}

export function ParkingLot({ items, onToggleResolved }: ParkingLotProps) {
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-foreground/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CircleHelp className="w-4 h-4 text-muted-foreground" />
        <div>
          <h3 className="font-gloria text-sm font-semibold leading-tight">
            Parking lot
          </h3>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            decisions before build · not a scope
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/40 italic">
          No open decisions
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleResolved?.(item.id, !item.resolved)}
              className="flex items-start gap-2 text-xs text-left py-1 group"
            >
              <span className="flex-shrink-0 text-muted-foreground/40 font-bold">
                ?
              </span>
              <span
                className={
                  item.resolved
                    ? 'line-through text-muted-foreground/40'
                    : 'text-foreground group-hover:text-foreground/80'
                }
              >
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
