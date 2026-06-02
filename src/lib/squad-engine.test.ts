import { describe, it, expect } from 'vitest'
import { resolveSquadByName, assignSquadColor } from './squad-engine'
import { SCOPE_PALETTE } from './color-engine'

const squads = [
  { id: 's1', name: 'Platform', color: '#3e63dd' },
  { id: 's2', name: 'Growth', color: '#e5484d' },
]

describe('resolveSquadByName', () => {
  it('finds a squad by its exact name', () => {
    expect(resolveSquadByName(squads, 'Platform')).toEqual(squads[0])
  })

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(resolveSquadByName(squads, 'platform')).toEqual(squads[0])
    expect(resolveSquadByName(squads, '  PLATFORM  ')).toEqual(squads[0])
  })

  it('treats punctuation/spacing variants as the same squad', () => {
    // slugify-based key: "Growth!" and "growth" normalize alike
    expect(resolveSquadByName(squads, 'growth!')).toEqual(squads[1])
  })

  it('returns null when no squad matches', () => {
    expect(resolveSquadByName(squads, 'Design')).toBeNull()
  })

  it('returns null for an empty or whitespace-only name', () => {
    expect(resolveSquadByName(squads, '')).toBeNull()
    expect(resolveSquadByName(squads, '   ')).toBeNull()
  })
})

describe('assignSquadColor', () => {
  it('returns a palette color for the first squad', () => {
    expect(SCOPE_PALETTE).toContain(assignSquadColor([]))
  })

  it('never reuses a color a sibling squad already has', () => {
    const used = [SCOPE_PALETTE[0], SCOPE_PALETTE[1]]
    const next = assignSquadColor(used)
    expect(used).not.toContain(next)
    expect(SCOPE_PALETTE).toContain(next)
  })
})
