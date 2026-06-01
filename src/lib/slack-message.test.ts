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
  needleProgress: 0.6,
  previousNeedleProgress: 0.6,
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

  it('omits the narrative block when the narrative is empty', () => {
    const withText = formatSlackMessage(BASE_PARAMS).blocks.length
    const without = formatSlackMessage({ ...BASE_PARAMS, narrative: '   ' }).blocks.length
    expect(without).toBe(withText - 1)
    // No section block should carry a blockquote marker.
    const hasQuote = formatSlackMessage({ ...BASE_PARAMS, narrative: '' }).blocks.some(
      (b) => b.type === 'section' && b.text.text.startsWith('>')
    )
    expect(hasQuote).toBe(false)
  })

  it('celebrates only when the needle reaches 100% (done)', () => {
    const done = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousNeedleProgress: 0.9, needleProgress: 1 }).blocks
    )
    expect(done).toContain('🎉 Needle at 100% — done!')

    // An ordinary forward move (not to 100%) gets no needle line.
    const forward = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousNeedleProgress: 0.48, needleProgress: 0.6 }).blocks
    )
    expect(forward).not.toContain('🎉')
  })

  it('reports a backward needle move as a neutral regression, not a celebration', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousNeedleProgress: 0.6, needleProgress: 0.48 }).blocks
    )
    expect(text).toContain('🔻 Needle slipped back 12% (60% → 48%)')
    expect(text).not.toContain('🎉')
  })

  it('stays silent on the needle line when it held steady', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousNeedleProgress: 0.6, needleProgress: 0.6 }).blocks
    )
    expect(text).not.toContain('🎉')
    expect(text).not.toContain('🔻')
  })

  it('does not celebrate on the first-ever update (no previous progress)', () => {
    const text = allText(
      formatSlackMessage({ ...BASE_PARAMS, previousNeedleProgress: null, needleProgress: 0.6 }).blocks
    )
    expect(text).not.toContain('🎉')
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
