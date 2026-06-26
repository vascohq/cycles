import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for Mission Control. Hand-built to mirror the real layout (see
 * mission-control-view.tsx / pitch-timeline.tsx): the title row (cycle name +
 * cycle stepper, then actions), the aligned Cycle window strip, then squad
 * groups of two-line pitch-timeline rows (header + timebox bar).
 */
export function MissionControlSkeleton() {
  return (
    <main className="w-full max-w-screen-xl mx-auto px-6 pt-5 pb-8 flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        {/* cycle name, then cycle stepper + actions */}
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-9 w-52" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>

        {/* aligned Cycle window strip */}
        <div className="rounded-lg border bg-card px-4 py-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          </div>
        </div>
      </header>

      {/* squad filter chips + Add pitch */}
      <div className="flex flex-wrap items-center gap-2">
        {[16, 20, 14].map((w, i) => (
          <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
        <Skeleton className="ml-auto h-7 w-20 rounded-lg" />
      </div>

      {/* squad-grouped timeline */}
      <div className="flex flex-col gap-4">
        <SquadGroupSkeleton rows={3} />
        <SquadGroupSkeleton rows={2} />
      </div>
    </main>
  )
}

function SquadGroupSkeleton({ rows }: { rows: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-4" />
      </div>
      <div className="rounded-lg border bg-card divide-y overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <PitchRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function PitchRowSkeleton() {
  return (
    <div className="px-4 pt-2.5 pb-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-8" />
        <Skeleton className="h-4 w-2/5 max-w-[16rem]" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}
