import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdatesTimeline } from './updates-timeline'
import { deriveTimelineCards } from '@/lib/timeline-helpers'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

// Radix dropdown/dialog rely on pointer-capture and scrollIntoView, which jsdom
// doesn't implement — stub them so the menu actually opens under test.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

const users = new Map([['bob', { name: 'Bob', initials: 'B' }]])

function mkUpdate(id: string, posted_at: string): PitchUpdate {
  return {
    id,
    pitchId: 'p1',
    posted_at,
    posted_by: 'bob',
    narrative: `Narrative ${id}`,
    needle_snapshot: { progress: 0.5, zone: 'some_risk' },
    hill_snapshot: [],
    task_snapshot: [],
    timebox_snapshot: { daysLeft: 20, currentWeek: 2, totalWeeks: 6 },
  }
}

// deriveTimelineCards returns newest-first, so the newest update is card index 0.
const cards = deriveTimelineCards(
  [mkUpdate('u1', '2026-06-03T14:00:00Z'), mkUpdate('u2', '2026-06-10T14:00:00Z')],
  users
)

describe('UpdatesTimeline narrative markdown', () => {
  function renderNarrative(narrative: string) {
    const update = { ...mkUpdate('u1', '2026-06-03T14:00:00Z'), narrative }
    render(<UpdatesTimeline cards={deriveTimelineCards([update], users)} />)
  }

  it('renders bold, italic and inline code as markup', () => {
    renderNarrative('Shipped **auth**, still _tuning_ the `retry` path.')
    expect(screen.getByText('auth').tagName).toBe('STRONG')
    expect(screen.getByText('tuning').tagName).toBe('EM')
    expect(screen.getByText('retry').tagName).toBe('CODE')
  })

  it('renders lists as real list items', () => {
    renderNarrative('- shipped login\n- shipped signup')
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['shipped login', 'shipped signup'])
  })

  it('renders links safely in a new tab', () => {
    renderNarrative('See [the PR](https://example.com/pr/1).')
    const link = screen.getByRole('link', { name: 'the PR' })
    expect(link).toHaveAttribute('href', 'https://example.com/pr/1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('does not render raw HTML in the narrative', () => {
    renderNarrative('Careful <em>here</em>')
    expect(screen.queryByText('here')).toBeNull()
    expect(screen.getByText(/Careful <em>here<\/em>/)).toBeTruthy()
  })
})

describe('UpdatesTimeline delete affordance', () => {
  it('shows the actions menu only on the newest card', () => {
    render(<UpdatesTimeline cards={cards} onDeleteUpdate={vi.fn()} />)
    // One menu trigger total — only the newest card carries it.
    expect(screen.getAllByLabelText('Update actions')).toHaveLength(1)
  })

  it('renders no menu when onDeleteUpdate is absent (e.g. done pitch)', () => {
    render(<UpdatesTimeline cards={cards} />)
    expect(screen.queryByLabelText('Update actions')).toBeNull()
  })

  it('fires onDeleteUpdate with the newest update id after confirming', async () => {
    const user = userEvent.setup()
    const onDeleteUpdate = vi.fn()
    render(<UpdatesTimeline cards={cards} onDeleteUpdate={onDeleteUpdate} />)

    await user.click(screen.getByLabelText('Update actions'))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    // Confirm dialog — click the destructive confirm button.
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDeleteUpdate).toHaveBeenCalledWith('u2')
  })

  it('does not fire onDeleteUpdate when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup()
    const onDeleteUpdate = vi.fn()
    render(<UpdatesTimeline cards={cards} onDeleteUpdate={onDeleteUpdate} />)

    await user.click(screen.getByLabelText('Update actions'))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(onDeleteUpdate).not.toHaveBeenCalled()
  })
})
