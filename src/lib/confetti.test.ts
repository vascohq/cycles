import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import confetti from 'canvas-confetti'
import { fireScopeDoneConfetti, startConfettiRain } from './confetti'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const mockConfetti = vi.mocked(confetti)

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  mockConfetti.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fireScopeDoneConfetti', () => {
  it('bursts from the given origin', () => {
    setReducedMotion(false)
    fireScopeDoneConfetti({ x: 0.8, y: 0.6 })
    expect(mockConfetti).toHaveBeenCalledTimes(1)
    expect(mockConfetti.mock.calls[0][0]).toMatchObject({ origin: { x: 0.8, y: 0.6 } })
  })

  it('does nothing when the user prefers reduced motion', () => {
    setReducedMotion(true)
    fireScopeDoneConfetti({ x: 0.8, y: 0.6 })
    expect(mockConfetti).not.toHaveBeenCalled()
  })
})

describe('startConfettiRain', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps emitting confetti over time while running', () => {
    setReducedMotion(false)
    const stop = startConfettiRain()
    vi.advanceTimersByTime(1000)
    const calls = mockConfetti.mock.calls.length
    expect(calls).toBeGreaterThan(1)
    stop()
  })

  it('stops emitting once the returned stop function is called', () => {
    setReducedMotion(false)
    const stop = startConfettiRain()
    vi.advanceTimersByTime(500)
    const callsBeforeStop = mockConfetti.mock.calls.length
    stop()
    vi.advanceTimersByTime(2000)
    expect(mockConfetti.mock.calls.length).toBe(callsBeforeStop)
  })

  it('never emits when the user prefers reduced motion', () => {
    setReducedMotion(true)
    const stop = startConfettiRain()
    vi.advanceTimersByTime(2000)
    expect(mockConfetti).not.toHaveBeenCalled()
    stop()
  })

  it('rains gold when asked for a gold celebration', () => {
    setReducedMotion(false)
    const stop = startConfettiRain(true)
    vi.advanceTimersByTime(300)
    const colors = mockConfetti.mock.calls[0][0]?.colors ?? []
    expect(colors.length).toBeGreaterThan(0)
    // every color is a warm gold tone (red & green channels high, blue low)
    for (const c of colors) {
      const r = parseInt(c.slice(1, 3), 16)
      const b = parseInt(c.slice(5, 7), 16)
      expect(r).toBeGreaterThan(b)
    }
    stop()
  })

  it('rains multi-colored (no fixed gold palette) for a normal celebration', () => {
    setReducedMotion(false)
    const stop = startConfettiRain(false)
    vi.advanceTimersByTime(300)
    expect(mockConfetti.mock.calls[0][0]?.colors).toBeUndefined()
    stop()
  })
})
