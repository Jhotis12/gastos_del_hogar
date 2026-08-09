import { RotateCcw, WifiOff } from 'lucide-react'
import { errorMessage } from '@/shared/lib/utils'

interface QueryErrorProps {
  error: unknown
  onRetry?: () => void
}

// Error de carga de datos: título amigable, qué pasó, cómo arreglarlo y
// reintento. No es vago: el detalle técnico queda pequeño y discreto.
export default function QueryError({ error, onRetry }: QueryErrorProps) {
  const detail = errorMessage(error)
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <div className="rounded-2xl border border-coral-200 bg-coral-100/30 p-6 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-100 text-coral-600">
        <WifiOff size={22} />
      </span>
      <p className="font-display text-base font-bold text-ink">
        Ups… contenido no disponible
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink/55">
        {offline
          ? 'Parece que estás sin conexión. Revisa tu red y vuelve a intentarlo.'
          : 'No pudimos cargar esta sección. Inténtalo de nuevo en un momento.'}
      </p>
      <p className="mx-auto mt-2 max-w-sm truncate text-xs text-ink/40">{detail}</p>
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
