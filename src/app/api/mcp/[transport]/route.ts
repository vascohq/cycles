import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyMcpToken } from '@/lib/mcp/auth'
import { registerCyclesTools } from '@/lib/mcp/tools'

const handler = createMcpHandler(
  (server) => {
    registerCyclesTools(server)
  },
  { serverInfo: { name: 'cycles', version: '1.0.0' } },
  { basePath: '/api/mcp' }
)

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export {
  authHandler as GET,
  authHandler as POST,
  authHandler as DELETE,
}
