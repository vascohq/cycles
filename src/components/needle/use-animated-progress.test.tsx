import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnimatedProgress } from './use-animated-progress'

let rafQueue: FrameRequestCallback[] = []
let clock = 0

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

function advance(to: number) {
  const callbacks = rafQueue
  rafQueue = []
  clock = to
  act(() => callbacks.forEach((cb) => cb(clock)))
}

beforeEach(() => {
  rafQueue = []
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAnimatedProgress', () => {
  it('sweeps from far-left toward the target', () => {
    mockReducedMotion(false)
    const { result } = renderHook(() => useAnimatedProgress(0.8))

    expect(result.current).toBe(0)

    advance(350)
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(0.8)

    advance(700)
    expect(result.current).toBeCloseTo(0.8)
  })

  it('glides from the current value toward a new target', () => {
    mockReducedMotion(false)
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedProgress(target),
      { initialProps: { target: 0.8 } }
    )

    advance(700)
    expect(result.current).toBeCloseTo(0.8)

    rerender({ target: 0.2 })
    advance(1400)
    expect(result.current).toBeCloseTo(0.2)
  })

  it('defers the sweep until the delay elapses', () => {
    mockReducedMotion(false)
    let timerCb: (() => void) | null = null
    vi.stubGlobal('setTimeout', (cb: () => void) => {
      timerCb = cb
      return 1
    })
    vi.stubGlobal('clearTimeout', () => {})

    const { result } = renderHook(() => useAnimatedProgress(0.8, 200))

    // No frames scheduled yet — the sweep is waiting on the delay.
    expect(rafQueue).toHaveLength(0)
    expect(result.current).toBe(0)

    act(() => timerCb!())
    advance(700)
    expect(result.current).toBeCloseTo(0.8)
  })

  it('snaps to the target with reduced motion, no animation', () => {
    mockReducedMotion(true)
    const { result } = renderHook(() => useAnimatedProgress(0.8))

    expect(result.current).toBe(0.8)
    expect(rafQueue).toHaveLength(0)
  })
})
