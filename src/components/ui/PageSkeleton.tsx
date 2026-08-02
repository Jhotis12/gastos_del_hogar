import Skeleton from '@/components/ui/Skeleton'

// Esqueleto de página: imita el layout del Dashboard mientras cargan
// los guards, los lazy imports o el primer fetch de una página.
export default function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando contenido">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-36 w-full rounded-2xl sm:h-44" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="space-y-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
        <div className="card p-5">
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="space-y-3">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        </div>
      </div>
    </div>
  )
}
