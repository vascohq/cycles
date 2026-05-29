import { Skeleton } from '@/components/ui/skeleton'

export function MissionControlSkeleton() {
  return (
    <main className="w-full max-w-screen-lg mx-auto px-6 py-8 flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-8 w-52" />
      </header>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-6 rounded-full" />
          <Skeleton className="ml-auto h-7 w-20 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PitchCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  )
}

function PitchCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}
