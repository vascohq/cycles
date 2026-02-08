export default function BoardsLoading() {
  return (
    <main className="mt-16 w-full max-w-screen-md mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="font-bold">Boards</h1>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="border p-2 rounded-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-2 flex flex-col gap-1">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </main>
  )
}
