import { describe, it, expect } from 'vitest'
import { isPublicRoute } from './middleware'

// createRouteMatcher reads only req.nextUrl.pathname, so a minimal stub is enough.
const req = (pathname: string) => ({ nextUrl: { pathname } }) as never

describe('isPublicRoute', () => {
  it('treats the MCP transport endpoint as public so Clerk does not 404 its OAuth POST', () => {
    // /mcp runs its own OAuth verification via withMcpAuth; Clerk's session
    // protection must not intercept it (regression from #61 "prod route protection").
    expect(isPublicRoute(req('/mcp'))).toBe(true)
  })

  it('keeps protecting application routes', () => {
    expect(isPublicRoute(req('/acme/cycles'))).toBe(false)
  })
})
