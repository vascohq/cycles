import confetti from 'canvas-confetti'

/** Normalized viewport coordinates (0..1), as canvas-confetti expects. */
export type ConfettiOrigin = { x: number; y: number }

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// One-shot celebration burst fired when a scope reaches the foot of the hill
// (done). Originates from the dot's screen position so the celebration points
// at what got done. Skipped entirely for users who prefer reduced motion —
// the muted card + checkmark still convey completion.
export function fireScopeDoneConfetti(origin: ConfettiOrigin): void {
  if (prefersReducedMotion()) return
  confetti({
    origin,
    particleCount: 80,
    spread: 70,
    startVelocity: 35,
    ticks: 120,
    scalar: 0.9,
  })
}

// A small, snappy pop fired from a task's checkbox the moment it's checked
// done — a little flourish, much lighter than the scope-done burst (fewer,
// smaller, shorter-lived particles). Skipped under reduced motion.
export function fireTaskDoneConfetti(origin: ConfettiOrigin): void {
  if (prefersReducedMotion()) return
  confetti({
    origin,
    particleCount: 24,
    spread: 55,
    startVelocity: 18,
    ticks: 60,
    scalar: 0.6,
    gravity: 1.4,
  })
}

// Warm gold tones for the needle-at-100% finish. Each is #RRGGBB with the red
// channel above the blue channel, so it reads gold rather than silver/white.
const GOLD_PALETTE = ['#FFD700', '#FDB931', '#E6BE8A', '#D4AF37', '#F9E27A']

// A gentle, continuous confetti rain falling from the top of the page — the
// "victory lap" for a fully-shipped pitch. Emits a small handful of particles
// on a slow interval so it reads festive without hammering the CPU. Pass
// `gold` for the needle-100% finish (all-gold); otherwise it's multi-colored
// (all scopes done). Returns a stop function; the caller MUST call it on
// cleanup. A no-op (stop is still safe to call) under reduced motion.
export function startConfettiRain(gold = false): () => void {
  if (prefersReducedMotion()) return () => {}
  const interval = setInterval(() => {
    confetti({
      particleCount: 6,
      // Aim downward (default 90° shoots up, off the top of the screen).
      angle: 270,
      startVelocity: 25,
      spread: 55,
      ticks: 300,
      gravity: 0.8,
      scalar: 0.9,
      origin: { x: Math.random(), y: 0 },
      ...(gold ? { colors: GOLD_PALETTE } : {}),
    })
  }, 160)
  return () => clearInterval(interval)
}
