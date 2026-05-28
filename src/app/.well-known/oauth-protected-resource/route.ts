import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from '@clerk/mcp-tools/next'

const handler = protectedResourceHandlerClerk({
  scopes_supported: ['profile', 'email'],
})

const optionsHandler = metadataCorsOptionsRequestHandler()

export { handler as GET, optionsHandler as OPTIONS }
