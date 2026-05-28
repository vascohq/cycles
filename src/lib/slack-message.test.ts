import { describe, it, expect } from 'vitest'
import { formatSlackMessage, type SlackMessageParams } from './slack-message'

const BASE_PARAMS: SlackMessageParams = {
  pitchTitle: 'Mission Control',
  weekNumber: 3,
  totalWeeks: 6,
  zone: 'on_track',
  narrative: 'Scope map is fully wired. Hill chart drag works.',
  tasksDone: 9,
  tasksTotal: 13,
  daysLeft: 21,
  pitchUrl: 'https://cycles.vasco.app/vasco/cycles/cycle-34/mission-control',
  postedAt: '2026-06-10T14:30:00Z',
}

describe('formatSlackMessage', () => {
  it('includes pitch title and week info', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    expect(msg.text).toContain('Mission Control')
    expect(msg.text).toContain('Week 3 of 6')
  })

  it('includes zone label as emoji pill', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    expect(msg.text).toContain('On track')
  })

  it('includes the narrative text', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    expect(msg.text).toContain('Scope map is fully wired. Hill chart drag works.')
  })

  it('includes task count and days left', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    expect(msg.text).toContain('9/13 tasks done')
    expect(msg.text).toContain('21 days left')
  })

  it('includes View pitch link', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    expect(msg.text).toContain('<https://cycles.vasco.app/vasco/cycles/cycle-34/mission-control|View pitch →>')
  })

  it('uses correct zone emoji for each zone', () => {
    expect(formatSlackMessage({ ...BASE_PARAMS, zone: 'on_track' }).text).toContain('🟢')
    expect(formatSlackMessage({ ...BASE_PARAMS, zone: 'some_risk' }).text).toContain('🟡')
    expect(formatSlackMessage({ ...BASE_PARAMS, zone: 'concerned' }).text).toContain('🔴')
  })

  it('uses Slack date token for timezone-aware display', () => {
    const msg = formatSlackMessage(BASE_PARAMS)
    const epoch = Math.floor(new Date('2026-06-10T14:30:00Z').getTime() / 1000)
    expect(msg.text).toContain(`<!date^${epoch}^{date_short_pretty} at {time}|`)
  })
})
