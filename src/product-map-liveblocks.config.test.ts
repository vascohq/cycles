import { describe, it, expect } from 'vitest'
import { productMapRoomId } from './product-map-liveblocks.config'

describe('productMapRoomId', () => {
  it('builds the room id from an org prefix', () => {
    expect(productMapRoomId('org_456')).toBe('org_456:product-map')
  })

  it('builds the room id from a user prefix for a personal workspace', () => {
    expect(productMapRoomId('user_123')).toBe('user_123:product-map')
  })

  // The auth endpoint grants `{prefix}:*`, so the room has to sit under the
  // prefix for a member of the organization to reach it.
  it('sits under the prefix the Liveblocks auth endpoint grants', () => {
    expect(productMapRoomId('org_456').startsWith('org_456:')).toBe(true)
  })

  // Every cycle-scoped query is `roomId^"{prefix}:cycle:"`, so the Product Map
  // room falls outside it and the clean slate can never reach it (ADR 0021).
  it('sits outside the cycle-room prefix', () => {
    expect(productMapRoomId('org_456').startsWith('org_456:cycle:')).toBe(false)
  })
})
