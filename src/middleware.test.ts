import { describe, it, expect, afterEach, vi } from 'vitest'
import { isPublicRoute } from './middleware'

// createRouteMatcher reads only req.nextUrl.pathname, so a minimal stub is enough.
const req = (pathname: string) => ({ nextUrl: { pathname } }) as never

afterEach(() => vi.unstubAllEnvs())

describe('isPublicRoute', () => {
  it('treats the MCP transport endpoint as public so Clerk does not 404 its OAuth POST', () => {
    // /mcp runs its own OAuth verification via withMcpAuth; Clerk's session
    // protection must not intercept it (regression from #61 "prod route protection").
    expect(isPublicRoute(req('/mcp'))).toBe(true)
  })

  it('treats the OAuth discovery endpoints as public', () => {
    // Unauthenticated metadata endpoints the MCP client hits before the token
    // exists. Explicitly public so they survive a config.matcher change.
    expect(isPublicRoute(req('/.well-known/oauth-protected-resource'))).toBe(true)
    expect(isPublicRoute(req('/.well-known/oauth-authorization-server'))).toBe(true)
  })

  it('exposes the e2e fixtures only outside production', () => {
    // Playwright drives /e2e with no Clerk session via `yarn dev`; in production
    // it must be protected (E2ELayout also 404s it as a second layer).
    vi.stubEnv('NODE_ENV', 'development')
    expect(isPublicRoute(req('/e2e/scope-map'))).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    expect(isPublicRoute(req('/e2e/scope-map'))).toBe(false)
  })

  it('keeps protecting application routes', () => {
    expect(isPublicRoute(req('/acme/cycles'))).toBe(false)
  })
})
