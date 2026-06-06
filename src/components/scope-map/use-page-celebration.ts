'use client'

import { useEffect } from 'react'
import { startConfettiRain } from '@/lib/confetti'
import type { Celebration } from '@/lib/scope-map-helpers'

// Runs the page-wide gold confetti rain only once the needle reaches 100%
// (`gold`). The `color` phase (all scopes done) gets no rain — just the needle
// box shimmer that invites the final update (handled in the view). Tears the
// emitter down on unmount so the rain never leaks across pitches.
export function usePageCelebration(celebration: Celebration): void {
  useEffect(() => {
    if (celebration !== 'gold') return
    return startConfettiRain(true)
  }, [celebration])
}
