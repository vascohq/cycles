import { describe, it, expect } from 'vitest'
import { formatSlackMessage, slackMessageSchema, type SlackMessageParams } from './slack-message'

const BASE_PARAMS: SlackMessageParams = {
  pitchTitle: 'Mission Control',
  weekNumber: 3,
  totalWeeks: 6,
  zone: 'on_track',
  previousZone: 'on_track',
  authorName: 'Sebastien',
  narrative: 'Scope map is fully wired. Hill chart drag works.',
  movement: null,
  daysLeft: 21,
  pitchUrl: 'https://cycles.vasco.app/vasco/cycles/cycle-34/mission-control',
  postedAt: '2026-06-10T14:30:00Z',
}

// Flatten a block payload so tests can assert on content without coupling to
// exact block nesting.
function allText(blocks: ReturnType<typeof formatSlackMessage>['blocks']): string {
  return JSON.stringify(blocks)
}

// The zone line is the first section block (right after the header).
function zoneLineText(blocks: ReturnType<typeof formatSlackMessage>['blocks']): string {
  const section = blocks.find((b) => b.type === 'section')
  return section && 'text' in section ? section.text.text : ''
}

describe('formatSlackMessage blocks', () => {
  it('renders a header block with the pitch title', () => {
    const { blocks } = formatSlackMessage(BASE_PARAMS)
    const header = blocks.find((b) => b.type === 'header')
    expect(header).toBeDefined()
    expect(allText([header!])).toContain('Mission Control')
  })

  it('renders an unchanged zone flat with emoji and label', () => {
    const line = zoneLineText(formatSlackMessage(BASE_PARAMS).blocks)
    expect(line).toContain('🟢')
    expect(line).toContain('*On track*')
    expect(line).not.toContain('→')
    expect(line).not.toContain('was ')
  })

  it('renders a changed zone as a neutral transition with the prior label', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousZone: 'some_risk', zone: 'concerned' }).blocks
    )
    expect(text).toContain('🟡 → 🔴')
    expect(text).toContain('*Now concerned*')
    expect(text).toContain('(was some risk)')
  })

  it('renders the first-ever update (no previous zone) flat, no transition', () => {
    const line = zoneLineText(formatSlackMessage({ ...BASE_PARAMS, previousZone: null }).blocks)
    expect(line).toContain('*On track*')
    expect(line).not.toContain('→')
    expect(line).not.toContain('Now ')
  })

  it('renders the narrative as a blockquote, one quote marker per line', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, narrative: 'Line one.\nLine two.' }).blocks
    )
    // JSON-escaped newlines: each line carries its own "> " marker.
    expect(text).toContain('> Line one.\\n> Line two.')
  })

  it('includes the movement line when provided', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, movement: 'Checkout over the hill · +2 nudged forward' }).blocks
    )
    expect(text).toContain('Checkout over the hill · +2 nudged forward')
  })

  it('omits the movement line when null', () => {
    const withMovement = formatSlackMessage({ ...BASE_PARAMS, movement: 'X moved' }).blocks.length
    const without = formatSlackMessage({ ...BASE_PARAMS, movement: null }).blocks.length
    expect(without).toBe(withMovement - 1)
  })

  it('renders a muted footer with author, week, days left, date and link', () => {
    const footer = formatSlackMessage(BASE_PARAMS).blocks.find((b) => b.type === 'context')
    const text = allText([footer!])
    expect(text).toContain('Sebastien')
    expect(text).toContain('Week 3 of 6')
    expect(text).toContain('21 days left')
    expect(text).toContain('View pitch')
    expect(text).toContain(BASE_PARAMS.pitchUrl)
  })

  it('uses a Slack date token in the footer for timezone-aware display', () => {
    const epoch = Math.floor(new Date(BASE_PARAMS.postedAt).getTime() / 1000)
    expect(allText(formatSlackMessage(BASE_PARAMS).blocks)).toContain(
      `<!date^${epoch}^{date_short_pretty} at {time}|`
    )
  })

  it('never shows task counts', () => {
    expect(allText(formatSlackMessage(BASE_PARAMS).blocks)).not.toContain('tasks done')
  })

  it('provides a notification fallback containing the title and narrative', () => {
    const { text } = formatSlackMessage(BASE_PARAMS)
    expect(text).toContain('Mission Control')
    expect(text).toContain('Scope map is fully wired')
  })
})

describe('slackMessageSchema pitchUrl', () => {
  it('accepts https URLs', () => {
    expect(slackMessageSchema.safeParse(BASE_PARAMS).success).toBe(true)
  })

  it('accepts http://localhost URLs for local dev', () => {
    const params = { ...BASE_PARAMS, pitchUrl: 'http://localhost:3000/vasco/cycles/c/p' }
    expect(slackMessageSchema.safeParse(params).success).toBe(true)
  })

  it('rejects non-localhost http URLs', () => {
    const params = { ...BASE_PARAMS, pitchUrl: 'http://evil.example.com/redirect' }
    expect(slackMessageSchema.safeParse(params).success).toBe(false)
  })
})
