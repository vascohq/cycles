import { Skeleton } from '@/components/ui/skeleton'

export function ScopeMapSkeleton() {
  return (
    <main className="w-full max-w-screen-lg mx-auto px-6 py-8 flex flex-col gap-10">
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-4 w-16" />
      </nav>

      <section className="rounded-lg border bg-card p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 mc-row">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-32 w-60 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ScopeCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  )
}

function ScopeCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
