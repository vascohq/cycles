import { describe, it, expect } from 'vitest'
import { resolveAssigneeRef, type OrganizationUser } from './users'

const simon: OrganizationUser = {
  userId: 'user_simon',
  email: 'Simon@Vasco.app',
  name: 'Simon',
  initials: 'SI',
  hasImage: false,
  imageUrl: '',
}
const marie: OrganizationUser = {
  userId: 'user_marie',
  email: 'marie@vasco.app',
  name: 'Marie',
  initials: 'MA',
  hasImage: false,
  imageUrl: '',
}
const USERS = [simon, marie]

describe('resolveAssigneeRef', () => {
  it('resolves a raw userId to itself', () => {
    expect(resolveAssigneeRef('user_marie', USERS)).toBe('user_marie')
  })

  it('resolves an email case-insensitively to the userId', () => {
    expect(resolveAssigneeRef('simon@vasco.app', USERS)).toBe('user_simon')
    expect(resolveAssigneeRef('MARIE@VASCO.APP', USERS)).toBe('user_marie')
  })

  it('trims surrounding whitespace', () => {
    expect(resolveAssigneeRef('  user_simon  ', USERS)).toBe('user_simon')
  })

  it('returns null for an unknown ref', () => {
    expect(resolveAssigneeRef('nobody@example.com', USERS)).toBeNull()
    expect(resolveAssigneeRef('user_ghost', USERS)).toBeNull()
  })

  it('returns null for an empty ref', () => {
    expect(resolveAssigneeRef('', USERS)).toBeNull()
    expect(resolveAssigneeRef('   ', USERS)).toBeNull()
  })

  it('does not match on display name (ambiguous, unsupported)', () => {
    expect(resolveAssigneeRef('Simon', USERS)).toBeNull()
  })
})
