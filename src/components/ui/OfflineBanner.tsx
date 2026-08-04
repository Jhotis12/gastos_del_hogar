import { RefreshCw, WifiOff } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/useOffline'
import { syncNow } from '@/lib/offline/sync'
import { cn } from '@/lib/utils'

// Indicador sutil de conectividad: antena wifi roja en una esquina cuando
// no hay conexión (o hay cambios pendientes). Con pendientes muestra un
// badge con el conteo; un toque fuerza la sincronización.
export default function OfflineBanner() {
  const { isOnline, pending, syncing } = useOfflineStatus()

  if (isOnline && pending === 0 && !syncing) return null

  const label = !isOnline
    ? pending > 0
      ? `Sin conexión — ${pending} cambio(s) pendiente(s)`
      : 'Sin conexión'
    : syncing
      ? 'Sincronizando cambios…'
      : `${pending} cambio(s) pendiente(s) de sincronizar`

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => void syncNow()}
      className="fixed bottom-20 right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-md ring-1 ring-red-200 transition-transform active:scale-95 lg:bottom-6"
    >
      {syncing ? (
        <RefreshCw size={18} className="animate-spin text-red-500" />
      ) : (
        <WifiOff size={18} className="text-red-500" />
      )}
      {!syncing && pending > 0 && (
        <span
          className={cn(
            'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none text-white',
            isOnline ? 'bg-pine-600' : 'bg-red-500',
          )}
        >
          {pending}
        </span>
      )}
    </button>
  )
}
