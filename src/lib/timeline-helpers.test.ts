import { describe, it, expect } from 'vitest'
import { formatUpdateTimestamp, deriveTimelineCards } from './timeline-helpers'
import type { PitchUpdate } from '@/cycle-liveblocks.config'

describe('formatUpdateTimestamp', () => {
  it('formats ISO date as "Day Mon DD · H:MM AM/PM"', () => {
    const result = formatUpdateTimestamp('2025-06-03T14:30:00Z')
    expect(result).toMatch(/^Tue Jun 3 · 2:30 PM$/)
  })

  it('formats morning time correctly', () => {
    const result = formatUpdateTimestamp('2025-01-07T09:05:00Z')
    expect(result).toMatch(/^Tue Jan 7 · 9:05 AM$/)
  })
})

describe('deriveTimelineCards', () => {
  const updates: PitchUpdate[] = [
    {
      id: 'u1',
      pitchId: 'p1',
      posted_at: '2025-06-03T14:30:00Z',
      posted_by: 'user1',
      narrative: 'First update',
      needle_snapshot: { progress: 0.5, zone: 'some_risk' },
      hill_snapshot: [{ scopeId: 's1', hill_progress: 0.3 }],
      task_snapshot: [{ scopeId: 's1', done: 1, total: 3 }],
      timebox_snapshot: { daysLeft: 25, currentWeek: 2, totalWeeks: 6 },
    },
    {
      id: 'u2',
      pitchId: 'p1',
      posted_at: '2025-06-10T15:00:00Z',
      posted_by: 'user2',
      narrative: 'Second update',
      needle_snapshot: { progress: 0.85, zone: 'on_track' },
      hill_snapshot: [{ scopeId: 's1', hill_progress: 0.7 }],
      task_snapshot: [{ scopeId: 's1', done: 2, total: 3 }],
      timebox_snapshot: { daysLeft: 18, currentWeek: 3, totalWeeks: 6 },
    },
  ]

  const users = new Map([
    ['user1', { name: 'Alice', initials: 'A' }],
    ['user2', { name: 'Bob', initials: 'B' }],
  ])

  it('returns cards sorted newest-first', () => {
    const cards = deriveTimelineCards(updates, users)
    expect(cards[0].id).toBe('u2')
    expect(cards[1].id).toBe('u1')
  })

  it('enriches cards with author info', () => {
    const cards = deriveTimelineCards(updates, users)
    expect(cards[0].authorName).toBe('Bob')
    expect(cards[0].authorInitials).toBe('B')
    expect(cards[1].authorName).toBe('Alice')
  })

  it('computes scopes moved since previous update', () => {
    const cards = deriveTimelineCards(updates, users)
    // u2 is newest — compared to u1, scope s1 moved from 0.3 to 0.7
    expect(cards[0].scopesMoved).toBe(1)
    // u1 is oldest — no previous update to compare
    expect(cards[1].scopesMoved).toBe(0)
  })

  it('returns empty array for no updates', () => {
    expect(deriveTimelineCards([], users)).toEqual([])
  })

  it('marks cards without slack_attempted as not slackFailed', () => {
    const cards = deriveTimelineCards(updates, users)
    expect(cards[0].slackFailed).toBe(false)
    expect(cards[1].slackFailed).toBe(false)
  })

  it('marks cards with slack_attempted but no delivery as slackFailed', () => {
    const attempted: PitchUpdate[] = [
      { ...updates[0], slack_attempted: true },
    ]
    const cards = deriveTimelineCards(attempted, users)
    expect(cards[0].slackFailed).toBe(true)
  })

  it('marks cards with slack_delivered_at as not slackFailed', () => {
    const delivered: PitchUpdate[] = [
      { ...updates[0], slack_attempted: true, slack_delivered_at: '2025-06-03T14:31:00Z' },
    ]
    const cards = deriveTimelineCards(delivered, users)
    expect(cards[0].slackFailed).toBe(false)
  })

  it('computes a frozen trail diff vs the previous update snapshot', () => {
    const cards = deriveTimelineCards(updates, users)
    // u2 (newest) diffed against u1: s1 0.3 -> 0.7 is a forward move.
    const trail = cards[0].trails.find((t) => t.scopeId === 's1')
    expect(trail?.state).toBe('moved')
    expect(cards[0].rollup.moved).toBe(1)
    expect(cards[0].scopesMoved).toBe(1)
  })

  it('renders the first-ever update with all scopes as "new"', () => {
    const cards = deriveTimelineCards(updates, users)
    // u1 (oldest) has no predecessor -> empty previous -> all-new.
    const first = cards[1]
    expect(first.trails).toHaveLength(1)
    expect(first.trails[0].state).toBe('new')
    expect(first.rollup).toEqual({ moved: 0, stalled: 0, new: 1, dropped: 0 })
  })
})
