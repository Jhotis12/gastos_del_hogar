import { RotateCcw } from 'lucide-react'
import { errorMessage } from '@/lib/utils'

interface QueryErrorProps {
  error: unknown
  onRetry?: () => void
}

export default function QueryError({ error, onRetry }: QueryErrorProps) {
  return (
    <div className="rounded-2xl border border-coral-200 p-6 text-center">
      <p className="text-sm font-medium text-coral-600">No se pudieron cargar los datos</p>
      <p className="mt-1 text-xs text-coral-500">{errorMessage(error)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
        >
          <RotateCcw size={16} />
          Reintentar
        </button>
      )}
    </div>
  )
}
