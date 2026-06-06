import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  deliverSlackUpdate,
  isSlackConfigured,
  type SlackDeliveryResult,
} from './slack-delivery'
import type { SlackMessageParams } from './slack-message'

const PARAMS: SlackMessageParams = {
  pitchTitle: 'Mission Control',
  pitchEmoji: '',
  weekNumber: 3,
  totalWeeks: 6,
  zone: 'on_track',
  previousZone: 'on_track',
  authorName: 'Sebastien',
  narrative: 'Scope map wired.',
  movement: null,
  needleProgress: 0.6,
  previousNeedleProgress: 0.6,
  daysLeft: 21,
  pitchUrl: 'https://cycles.vasco.app/vasco/cycles/cycle-34/mission-control',
  postedAt: '2026-06-10T14:30:00Z',
}

afterEach(() => vi.unstubAllGlobals())

const WEBHOOK = 'https://hooks.slack.com/x'

describe('isSlackConfigured', () => {
  it('is true when an org webhook URL is provided', () => {
    expect(isSlackConfigured(WEBHOOK)).toBe(true)
  })

  it('is false when no webhook is configured', () => {
    expect(isSlackConfigured(undefined)).toBe(false)
    expect(isSlackConfigured('')).toBe(false)
  })
})

describe('deliverSlackUpdate', () => {
  it('reports failure without fetching when no webhook is configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverSlackUpdate(PARAMS, undefined)

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the formatted message to the org webhook and returns delivered_at', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverSlackUpdate(PARAMS, WEBHOOK)

    expect(result.ok).toBe(true)
    expect((result as Extract<SlackDeliveryResult, { ok: true }>).delivered_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(call[0]).toBe(WEBHOOK)
    const body = JSON.parse(call[1].body) as { text: string }
    expect(body.text).toContain('Mission Control')
  })

  it('reports failure when the webhook responds non-ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, text: () => Promise.resolve('no_service') })
    vi.stubGlobal('fetch', fetchMock)

    const result = await deliverSlackUpdate(PARAMS, WEBHOOK)

    expect(result.ok).toBe(false)
    expect((result as Extract<SlackDeliveryResult, { ok: false }>).error).toContain('no_service')
  })
})
