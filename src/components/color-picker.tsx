'use client'

import { Check } from 'lucide-react'
import { readableTextColor, SCOPE_PALETTE } from '@/lib/color-engine'

/**
 * Palette swatch picker shared by Scope Color and Squad Color. Colors already
 * used by siblings are flagged with a small ring + dot but stay selectable —
 * uniqueness is guaranteed on auto-assign, manual override is allowed (see
 * ADR 0008). A generated (non-palette) current color is shown first so it's
 * selectable too. Palette only — no free hex.
 */
export function ColorPicker({
  value,
  usedColors,
  onPick,
}: {
  value: string
  usedColors: string[]
  onPick: (color: string) => void
}) {
  const swatches = SCOPE_PALETTE.includes(value)
    ? SCOPE_PALETTE
    : [value, ...SCOPE_PALETTE]

  return (
    <div className="flex flex-wrap gap-1.5">
      {swatches.map((color) => {
        const selected = color === value
        const inUse = !selected && usedColors.includes(color)
        return (
          <button
            key={color}
            type="button"
            aria-label={inUse ? `${color} (in use)` : color}
            aria-pressed={selected}
            onClick={() => onPick(color)}
            className={`relative w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            {selected && (
              <Check
                className="w-3.5 h-3.5 absolute inset-0 m-auto"
                style={{ color: readableTextColor(color) }}
              />
            )}
            {inUse && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-foreground ring-1 ring-background" />
            )}
          </button>
        )
      })}
    </div>
  )
}
