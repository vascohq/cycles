import {
  authServerMetadataHandlerClerk,
  metadataCorsOptionsRequestHandler,
} from '@clerk/mcp-tools/next'

const handler = authServerMetadataHandlerClerk()
const optionsHandler = metadataCorsOptionsRequestHandler()

export { handler as GET, optionsHandler as OPTIONS }
