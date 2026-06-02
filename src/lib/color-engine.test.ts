import { describe, it, expect } from 'vitest'
import {
  readableTextColor,
  assignScopeColor,
  resolveScopeColors,
  SCOPE_PALETTE,
} from './color-engine'

describe('readableTextColor', () => {
  it('uses light text on a dark color', () => {
    expect(readableTextColor('#1a1a1a')).toBe('#ffffff')
  })

  it('uses dark text on a light color', () => {
    expect(readableTextColor('#ffd700')).toBe('#0a0a0a')
  })
})

describe('assignScopeColor', () => {
  it('returns a palette color for the first scope', () => {
    expect(SCOPE_PALETTE).toContain(assignScopeColor([]))
  })

  it('never reuses a color a sibling already has', () => {
    const used = [SCOPE_PALETTE[0], SCOPE_PALETTE[1]]
    const next = assignScopeColor(used)
    expect(used).not.toContain(next)
    expect(SCOPE_PALETTE).toContain(next)
  })

  it('spreads away from clustered hues rather than taking the next in the list', () => {
    // red + orange are used (adjacent warm hues). The next color should jump to
    // the most hue-distant unused color (cyan), not the next palette entry (amber).
    const next = assignScopeColor(['#e5484d', '#f76b15'])
    expect(next).toBe('#00a2c7')
  })

  it('generates a fresh color once the whole palette is used', () => {
    const next = assignScopeColor([...SCOPE_PALETTE])
    expect(SCOPE_PALETTE).not.toContain(next)
    expect(next).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps generated colors distinct from each other', () => {
    const thirteenth = assignScopeColor([...SCOPE_PALETTE])
    const fourteenth = assignScopeColor([...SCOPE_PALETTE, thirteenth])
    expect(fourteenth).not.toBe(thirteenth)
    expect(SCOPE_PALETTE).not.toContain(fourteenth)
  })
})

describe('resolveScopeColors', () => {
  it('honors a scope that already has a stored color', () => {
    const map = resolveScopeColors([{ id: 'a', color: '#123456' }])
    expect(map.a).toBe('#123456')
  })

  it('fills unset colors uniquely across siblings', () => {
    const map = resolveScopeColors([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ])
    const colors = [map.a, map.b, map.c]
    expect(new Set(colors).size).toBe(3)
  })

  it('fills around a stored color without colliding with it', () => {
    const map = resolveScopeColors([
      { id: 'a', color: SCOPE_PALETTE[0] },
      { id: 'b' },
    ])
    expect(map.a).toBe(SCOPE_PALETTE[0])
    expect(map.b).not.toBe(SCOPE_PALETTE[0])
  })

  it('assigns the same color to a scope regardless of build order (reorder-safe)', () => {
    const scopes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const forward = resolveScopeColors(scopes)
    const reordered = resolveScopeColors([scopes[2], scopes[0], scopes[1]])
    expect(reordered).toEqual(forward)
  })
})
