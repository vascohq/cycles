'use client'

export default function ScopeMapError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="w-full max-w-screen-lg mx-auto px-6 py-8">
      <h2 className="text-lg font-semibold tracking-tight mb-2">Failed to load Scope Map</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Something went wrong while loading this pitch.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  )
}
