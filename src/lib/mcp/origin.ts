// Resolves the absolute origin the MCP server advertises (used to build its
// icon URL so remote clients like Claude can fetch it). Each environment
// advertises the URL it is actually reachable at:
//   • production → the stable production domain
//   • preview    → this deployment's own URL (not production's)
//   • local dev  → localhost
// NEXT_PUBLIC_APP_URL overrides everything (e.g. a custom production domain).
//
// Pure over its `env` argument so it can be unit-tested across environments.
export function resolveOrigin(
  env: Record<string, string | undefined> = process.env
): string {
  const override = env.NEXT_PUBLIC_APP_URL
  if (override) return override.replace(/\/$/, '')

  if (env.VERCEL_ENV === 'production') {
    const prod =
      env.VERCEL_PROJECT_PRODUCTION_URL ?? env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    if (prod) return `https://${prod}`
  }

  // Preview and any other Vercel deployment: use this deployment's own URL.
  const deploymentUrl = env.VERCEL_URL ?? env.NEXT_PUBLIC_VERCEL_URL
  if (deploymentUrl) return `https://${deploymentUrl}`

  return 'http://localhost:3000'
}
