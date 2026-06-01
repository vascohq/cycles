import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { Implementation } from '@modelcontextprotocol/sdk/types.js'
import { verifyMcpToken } from '@/lib/mcp/auth'
import { registerCyclesTools } from '@/lib/mcp/tools'

// Absolute origin so remote clients (e.g. Claude) can fetch the server icon.
// Prefer an explicit override, then Vercel's stable production domain, then dev.
const origin = process.env.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000'

// mcp-handler passes serverInfo straight to McpServer, which accepts the full
// Implementation (title/description/websiteUrl/icons) — but its own exported type
// narrows it to { name, version }, so we type it here and cast at the call site.
const serverInfo: Implementation = {
  name: 'cycles',
  title: 'Cycles',
  version: '1.0.0',
  description:
    'Manage Shape Up cycles, pitches, scopes, tasks and parking-lot items. Read tools query a cycle; write tools create, update or delete its contents.',
  websiteUrl: origin,
  icons: [
    {
      src: `${origin}/web-app-manifest-512x512.png`,
      mimeType: 'image/png',
      sizes: ['512x512'],
    },
    {
      src: `${origin}/icon.svg`,
      mimeType: 'image/svg+xml',
      sizes: ['any'],
    },
  ],
}

const handler = createMcpHandler(
  (server) => {
    registerCyclesTools(server)
  },
  { serverInfo: serverInfo as { name: string; version: string } },
  { streamableHttpEndpoint: '/mcp', disableSse: true }
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
