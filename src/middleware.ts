import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes. `/e2e` renders fixture data with no auth so Playwright can
// drive it in dev; it is 404'd in production by src/app/e2e/layout.tsx.
// `/mcp` runs its own OAuth verification via withMcpAuth (src/app/mcp/route.ts),
// so it must bypass Clerk's session protection — otherwise auth.protect() 404s
// the JSON-RPC POST that carries an MCP bearer token, not a Clerk session.
export const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/e2e(.*)',
  '/mcp(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
