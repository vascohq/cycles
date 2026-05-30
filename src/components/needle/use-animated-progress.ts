import { useEffect, useRef, useState } from 'react'

const DURATION = 700
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Drives a progress value toward `target`: sweeps from far-left (0) on mount and
// glides old -> new on change. `delayMs` staggers the start (e.g. behind a card
// entrance). With reduced-motion the value snaps, no animation.
export function useAnimatedProgress(target: number, delayMs = 0) {
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState(0)
  const current = useRef(0)
  const frame = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (reduced) return

    const from = current.current

    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION)
        const next = from + (target - from) * easeOut(t)
        current.current = next
        setValue(next)
        if (t < 1) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }

    if (delayMs > 0) {
      timer.current = setTimeout(run, delayMs)
    } else {
      run()
    }

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [target, delayMs, reduced])

  return reduced ? target : value
}
