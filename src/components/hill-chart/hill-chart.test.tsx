import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { HillChart, type HillScope } from './hill-chart'

const SCOPE: HillScope = {
  id: 's1',
  title: 'Auth flow',
  tier: 'must',
  hill_progress: 0.2,
  order: 1,
  color: '#e5484d',
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 400,
    bottom: 200,
    width: 400,
    height: 200,
    toJSON: () => ({}),
  }))
})

function dotGroup(container: HTMLElement) {
  // The draggable dot is the <g> carrying data-scope-dot (a <circle> + <text>
  // wrapped by a per-step cluster group).
  const dot = container.querySelector('[data-scope-dot]')
  if (!dot) throw new Error('dot group not found')
  return dot
}

describe('HillChart core scope accent', () => {
  it('marks the core scope dot with a star accent', () => {
    const { container } = render(
      <HillChart scopes={[{ ...SCOPE, isCore: true }]} />
    )
    expect(container.querySelector('[data-core-accent="s1"]')).toBeTruthy()
  })

  it('shows no accent when no scope is core', () => {
    const { container } = render(<HillChart scopes={[SCOPE]} />)
    expect(container.querySelector('[data-core-accent]')).toBeNull()
  })
})

describe('HillChart drag-to-set hill_progress', () => {
  it('persists once on drag end, not on every mousemove', () => {
    const onHillProgressChange = vi.fn()

    const { container } = render(
      <HillChart
        scopes={[SCOPE]}
        onHillProgressChange={onHillProgressChange}
      />
    )

    const dot = dotGroup(container)

    fireEvent.mouseDown(dot, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 120 })
    fireEvent.mouseMove(window, { clientX: 160 })
    fireEvent.mouseMove(window, { clientX: 200 })

    expect(onHillProgressChange).not.toHaveBeenCalled()

    fireEvent.mouseUp(window)

    expect(onHillProgressChange).toHaveBeenCalledTimes(1)
    expect(onHillProgressChange.mock.calls[0][0]).toBe('s1')
    const finalProgress = onHillProgressChange.mock.calls[0][1]
    expect(finalProgress).toBeGreaterThanOrEqual(0.02)
    expect(finalProgress).toBeLessThanOrEqual(0.98)
  })

  it('does not fire onHillProgressChange when the dot is pressed without moving', () => {
    const onHillProgressChange = vi.fn()

    const { container } = render(
      <HillChart
        scopes={[SCOPE]}
        onHillProgressChange={onHillProgressChange}
      />
    )

    fireEvent.mouseDown(dotGroup(container), { clientX: 100 })
    fireEvent.mouseUp(window)

    expect(onHillProgressChange).not.toHaveBeenCalled()
  })

  it('does not attach drag listeners when onHillProgressChange is not provided', () => {
    const { container } = render(<HillChart scopes={[SCOPE]} />)

    expect(() => {
      fireEvent.mouseDown(dotGroup(container), { clientX: 100 })
      fireEvent.mouseMove(window, { clientX: 200 })
      fireEvent.mouseUp(window)
    }).not.toThrow()
  })
})
