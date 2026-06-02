'use client'

import { useRouter } from 'next/navigation'
import { Layers, Target } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ZONE_COLORS, NULL_COLOR } from '@/components/needle/zone-colors'
import type { Stage } from '@/cycle-liveblocks.config'
import { cn } from '@/lib/utils'
import { useCommandPalette } from './command-palette-context'
import type { PaletteCycleItem } from './types'

const STAGE_BADGE_STYLES: Record<Stage, string> = {
  framing: 'bg-muted text-muted-foreground',
  shaping:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  building:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  done: 'bg-foreground text-background',
}

function cycleDateRange(cycle: PaletteCycleItem): string | null {
  if (!cycle.start_date || !cycle.end_date) return null
  return `${cycle.start_date} → ${cycle.end_date}`
}

export function CommandPalette() {
  const { open, setOpen, slug, cycles, cyclesLoading, pitchItems } =
    useCommandPalette()
  const router = useRouter()

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search cycles and pitches…" />
      <CommandList>
        <CommandEmpty>
          {cyclesLoading ? 'Loading…' : 'No results found.'}
        </CommandEmpty>

        {pitchItems.length > 0 && (
          <CommandGroup heading="Pitches">
            {pitchItems.map((pitch) => (
              <CommandItem
                key={pitch.id}
                value={`pitch ${pitch.title} ${pitch.id}`}
                onSelect={() => go(pitch.href)}
              >
                {pitch.emoji ? (
                  <span className="w-4 text-center leading-none">
                    {pitch.emoji}
                  </span>
                ) : (
                  <Target className="text-muted-foreground" />
                )}
                <span className="truncate">{pitch.title}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: pitch.zone
                        ? ZONE_COLORS[pitch.zone]
                        : NULL_COLOR,
                    }}
                  />
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      STAGE_BADGE_STYLES[pitch.stage]
                    )}
                  >
                    {pitch.stage}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {cycles.length > 0 && (
          <CommandGroup heading="Cycles">
            {cycles.map((cycle) => {
              const range = cycleDateRange(cycle)
              return (
                <CommandItem
                  key={cycle.slug}
                  value={`cycle ${cycle.title} ${cycle.slug}`}
                  onSelect={() => go(`/${slug}/cycles/${cycle.slug}`)}
                >
                  <Layers className="text-muted-foreground" />
                  <span className="truncate">{cycle.title}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {cycle.type === 'cooldown' && (
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        Cooldown
                      </span>
                    )}
                    {range && <span className="hidden sm:inline">{range}</span>}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
