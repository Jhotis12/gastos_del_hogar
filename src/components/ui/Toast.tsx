import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
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

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-xs flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-slide-in pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface p-3.5 shadow-lg',
              t.type === 'success' ? 'border-pine-200' : 'border-coral-200',
            )}
          >
            {t.type === 'success' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-pine-600" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-coral-600" />
            )}
            <p className="flex-1 text-sm text-ink/80">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded p-0.5 text-ink/40 hover:text-ink/55"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
