'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-[100dvh] items-center justify-center">
        <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground text-sm mb-4">
          An unexpected error occurred.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
