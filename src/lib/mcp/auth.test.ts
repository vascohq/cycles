import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateMcpAuth } from './auth'

function makeRequest(token?: string): Request {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return new Request('http://localhost/api/mcp', { headers })
}

describe('validateMcpAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 503 when MCP_SECRET_KEY is not set', () => {
    vi.stubEnv('MCP_SECRET_KEY', '')
    vi.stubEnv('MCP_ORG_ID', 'org_123')
    const result = validateMcpAuth(makeRequest('some-token'))
    expect(result).toEqual({ ok: false, status: 503, error: 'MCP not configured' })
  })

  it('returns 503 when MCP_ORG_ID is not set', () => {
    vi.stubEnv('MCP_SECRET_KEY', 'secret')
    vi.stubEnv('MCP_ORG_ID', '')
    const result = validateMcpAuth(makeRequest('secret'))
    expect(result).toEqual({ ok: false, status: 503, error: 'MCP not configured' })
  })

  it('returns 401 when no Authorization header is present', () => {
    vi.stubEnv('MCP_SECRET_KEY', 'secret')
    vi.stubEnv('MCP_ORG_ID', 'org_123')
    const result = validateMcpAuth(makeRequest())
    expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('returns 401 when token does not match', () => {
    vi.stubEnv('MCP_SECRET_KEY', 'secret')
    vi.stubEnv('MCP_ORG_ID', 'org_123')
    const result = validateMcpAuth(makeRequest('wrong-token'))
    expect(result).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('returns ok with orgId when token matches', () => {
    vi.stubEnv('MCP_SECRET_KEY', 'secret')
    vi.stubEnv('MCP_ORG_ID', 'org_123')
    const result = validateMcpAuth(makeRequest('secret'))
    expect(result).toEqual({ ok: true, orgId: 'org_123' })
  })
})
