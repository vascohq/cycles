'use client'

export default function BoardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mt-16 w-full max-w-screen-md mx-auto">
      <h2 className="text-lg font-bold mb-2">Failed to load boards</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Something went wrong while loading your boards.
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
