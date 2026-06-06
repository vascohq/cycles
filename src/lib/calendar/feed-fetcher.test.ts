import { describe, it, expect, vi } from 'vitest'
import { fetchOverlayBands } from './feed-fetcher'

const RANGE = { start: '2026-01-01', end: '2026-12-31' }

const HOLIDAY_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//test//EN',
  'BEGIN:VEVENT',
  'UID:canada-day-2026',
  'SUMMARY:Canada Day',
  'DTSTART;VALUE=DATE:20260701',
  'DTEND;VALUE=DATE:20260702',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const ok = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response

describe('fetchOverlayBands', () => {
  it('skips a feed that fails and keeps bands from the ones that succeed', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) =>
      String(url).includes('broken')
        ? ({ ok: false, status: 404, text: async () => '' } as Response)
        : ok(HOLIDAY_ICS)
    )

    const bands = await fetchOverlayBands(
      {
        feeds: [
          { id: 'a', kind: 'holiday', label: 'Canada', url: 'https://good.example/ca.ics', color: '#3e63dd' },
          { id: 'b', kind: 'timeoff', label: 'Humi', url: 'https://broken.example/x.ics', color: '#30a46c' },
        ],
      },
      RANGE,
      fetchImpl
    )

    expect(bands).toHaveLength(1)
    expect(bands[0]?.summary).toBe('Canada Day')
    expect(bands[0]?.color).toBe('#3e63dd') // the feed's color is attached
  })

  it('returns no bands instead of throwing when a fetch rejects', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    const bands = await fetchOverlayBands(
      { feeds: [{ id: 'a', kind: 'timeoff', label: 'Humi', url: 'https://humi.example/x.ics', color: '#30a46c' }] },
      RANGE,
      fetchImpl
    )

    expect(bands).toEqual([])
  })

  it('rewrites webcal:// to https:// when fetching', async () => {
    const fetchImpl = vi.fn(async () => ok(HOLIDAY_ICS))

    await fetchOverlayBands(
      { feeds: [{ id: 'a', kind: 'timeoff', label: 'Humi', url: 'webcal://api.humi.ca/feed.ics', color: '#30a46c' }] },
      RANGE,
      fetchImpl
    )

    expect(fetchImpl).toHaveBeenCalledWith('https://api.humi.ca/feed.ics', expect.anything())
  })
})
