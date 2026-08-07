import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
  info: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

// Emisor de toasts fuera del árbol de React (colas offline, sync, etc.).
type ToastListener = (type: ToastItem['type'], message: string) => void
const toastListeners = new Set<ToastListener>()

export function subscribeToasts(listener: ToastListener): () => void {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

export function emitToast(type: ToastItem['type'], message: string): void {
  for (const listener of toastListeners) listener(type, message)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = Date.now() + Math.random()
      setToasts((current) => [...current, { id, type, message }])
      setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  useEffect(() => subscribeToasts((type, message) => push(type, message)), [push])

  const success = useCallback((message: string) => push('success', message), [push])
  const error = useCallback((message: string) => push('error', message), [push])
  const info = useCallback((message: string) => push('info', message), [push])

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[100] flex w-full max-w-xs flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-slide-in pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface p-3.5 shadow-lg',
              t.type === 'success'
                ? 'border-pine-200'
                : t.type === 'error'
                  ? 'border-coral-200'
                  : 'border-slate-300',
            )}
          >
            {t.type === 'success' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-pine-600" />
            ) : t.type === 'error' ? (
              <XCircle size={18} className="mt-0.5 shrink-0 text-coral-600" />
            ) : (
              <Info size={18} className="mt-0.5 shrink-0 text-pine-600" />
            )}
            <p className="flex-1 text-sm text-ink/80">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded p-1.5 text-ink/40 hover:text-ink/55"
              aria-label="Cerrar notificación"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
