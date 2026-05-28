import { createMcpHandler } from 'mcp-handler'
import { validateMcpAuth } from '@/lib/mcp/auth'
import { registerCyclesTools } from '@/lib/mcp/tools'

const handler = createMcpHandler(
  (server) => {
    const orgId = process.env.MCP_ORG_ID
    if (!orgId) return
    registerCyclesTools(server, orgId)
  },
  { serverInfo: { name: 'cycles', version: '1.0.0' } },
  { basePath: '/api/mcp' }
)

async function withAuth(request: Request) {
  const result = validateMcpAuth(request)
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return handler(request)
}

export { withAuth as GET, withAuth as POST, withAuth as DELETE }
