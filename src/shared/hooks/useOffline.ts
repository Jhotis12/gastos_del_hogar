import { useSyncExternalStore } from 'react'
import {
  getOfflineStatus,
  subscribeOfflineStatus,
  type OfflineStatus,
} from '@/shared/lib/offline/sync'

// Estado de conectividad y cola pendiente, reactivo a los eventos del
// navegador (offline/online) y a los cambios de la cola.
export function useOfflineStatus(): OfflineStatus {
  return useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus)
}
