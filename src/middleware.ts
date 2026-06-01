import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that bypass Clerk's session protection in every environment:
// - /mcp runs its own OAuth verification via withMcpAuth (src/app/mcp/route.ts);
//   otherwise auth.protect() 404s the JSON-RPC POST, which carries an MCP bearer
//   token, not a Clerk session.
// - /.well-known/oauth-* are the unauthenticated OAuth discovery endpoints the
//   MCP client hits before a token exists. The config.matcher dot rule already
//   excludes them, but listing them here is explicit and survives matcher changes.
// Sign-in/sign-up are intentionally absent: auth is hosted on Clerk's Account
// Portal, so there are no in-app /sign-in routes to exempt.
const isAlwaysPublic = createRouteMatcher([
  '/mcp(.*)',
  '/.well-known/oauth-authorization-server(.*)',
  '/.well-known/oauth-protected-resource(.*)',
])

// /e2e renders fixture data with no auth so Playwright can drive it via
// `yarn dev`. Public only outside production; E2ELayout 404s it in production
// (src/app/e2e/layout.tsx) as a second layer.
const isDevOnlyPublic = createRouteMatcher(['/e2e(.*)'])

export function isPublicRoute(req: Parameters<typeof isAlwaysPublic>[0]) {
  if (isAlwaysPublic(req)) return true
  return process.env.NODE_ENV !== 'production' && isDevOnlyPublic(req)
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
