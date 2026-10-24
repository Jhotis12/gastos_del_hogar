import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

// Aviso de nueva actualización (PWA): cuando el service worker detecta un
// nuevo build (tras un push/deploy), muestra el aviso y permite actualizar
// con un toque. Mientras la app está abierta se revisa cada hora.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          void registration.update()
        }, 60 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] z-[95] flex justify-center px-4 lg:bottom-6">
      <div
        role="alert"
        aria-live="assertive"
        className="animate-fade-up flex w-full max-w-sm items-center gap-3 rounded-2xl border border-pine-200 bg-surface p-4 shadow-xl"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-50 text-pine-600">
          <RefreshCw size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Nueva actualización disponible</p>
          <p className="mt-0.5 text-xs text-ink/50">
            Hay una versión más reciente de la app
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => updateServiceWorker(true)}
            className="inline-flex min-h-11 items-center rounded-lg bg-pine-700 px-3 py-2 text-sm font-medium text-white hover:bg-pine-800"
          >
            Actualizar
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            aria-label="Descartar aviso de actualización"
            className="rounded-lg p-2.5 text-ink/40 hover:bg-cream hover:text-ink/70"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
