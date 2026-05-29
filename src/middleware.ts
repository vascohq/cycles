import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes. `/e2e` renders fixture data with no auth so Playwright can
// drive it in dev; it is 404'd in production by src/app/e2e/layout.tsx.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/e2e(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
