import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveNeedleModal } from './move-needle-modal'

afterEach(cleanup)

const BASE_PROPS = {
  open: true,
  onOpenChange: () => {},
  weekLabel: 'Week 3 of 6',
  dateLabel: 'May 27, 2025',
  userName: 'Seb',
  pitchTitle: 'Mission Control',
  tasksDone: 9,
  tasksTotal: 13,
  daysLeft: 21,
  currentProgress: 0.5,
  currentZone: null,
}

describe('MoveNeedleModal', () => {
  it('posts the placed progress, chosen zone, and narrative', async () => {
    const user = userEvent.setup()
    const onPost = vi.fn()
    render(<MoveNeedleModal {...BASE_PROPS} onPost={onPost} />)

    await user.click(screen.getByRole('button', { name: 'On track' }))
    await user.type(
      screen.getByPlaceholderText(/Ship something/),
      'Shipped the gauge'
    )

    const slider = screen.getByRole('slider', { name: 'Needle position' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    await user.click(screen.getByRole('button', { name: /Post update/ }))

    expect(onPost).toHaveBeenCalledTimes(1)
    const [progress, zone, narrative] = onPost.mock.calls[0]
    expect(progress).toBeCloseTo(0.6)
    expect(zone).toBe('on_track')
    expect(narrative).toBe('Shipped the gauge')
  })

  it('disables posting until position, zone, and narrative are present', async () => {
    const user = userEvent.setup()
    render(<MoveNeedleModal {...BASE_PROPS} onPost={vi.fn()} />)

    const post = screen.getByRole('button', { name: /Post update/ })
    expect(post).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Concerned' }))
    expect(post).toBeDisabled()

    await user.type(
      screen.getByPlaceholderText(/Ship something/),
      'Hit a wall'
    )
    expect(post).toBeEnabled()
  })

  it('pre-fills zone and position from the current needle', async () => {
    const user = userEvent.setup()
    const onPost = vi.fn()
    render(
      <MoveNeedleModal
        {...BASE_PROPS}
        currentProgress={0.75}
        currentZone="some_risk"
        onPost={onPost}
      />
    )

    // No zone click — the pre-filled zone should be used.
    await user.type(screen.getByPlaceholderText(/Ship something/), 'Steady')
    await user.click(screen.getByRole('button', { name: /Post update/ }))

    const [progress, zone] = onPost.mock.calls[0]
    expect(progress).toBeCloseTo(0.75)
    expect(zone).toBe('some_risk')
  })
})
