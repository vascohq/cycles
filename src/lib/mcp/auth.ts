type AuthResult =
  | { ok: true; orgId: string }
  | { ok: false; status: 401 | 503; error: string }

export function validateMcpAuth(request: Request): AuthResult {
  const secretKey = process.env.MCP_SECRET_KEY
  const orgId = process.env.MCP_ORG_ID

  if (!secretKey || !orgId) {
    return { ok: false, status: 503, error: 'MCP not configured' }
  }

  const header = request.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (token !== secretKey) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true, orgId }
}
