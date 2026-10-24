import type { QueryClient } from '@tanstack/react-query'
import { isNetworkError as isPureNetworkError } from './isNetworkError'

// Re-export puro + wrapper que considera navigator.onLine como offline.
// La fuente de verdad es `isPureNetworkError(err) || !navigator.onLine` en los callers;
// se mantiene este wrapper para compatibilidad y para `runWithOfflineFallback`.
export function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true
  return isPureNetworkError(err)
}

export { isPureNetworkError }

// Las invalidaciones offline disparan refetches que el navegador bloquea
// (ruido CORS en consola). Sin red solo se actualiza la caché en memoria;
// el refetch real ocurre al reconectar (syncNow → invalidateQueries).
export function invalidateIfOnline(
  queryClient: QueryClient,
  keys: string[][],
): void {
  if (!navigator.onLine) return
  for (const key of keys) queryClient.invalidateQueries({ queryKey: key })
}

// Resultado de una mutación que quedó en la cola offline (todavía no se
// escribió en el servidor): las páginas lo usan para no mostrar además su
// propio aviso de éxito, porque la señal es "Guardado sin conexión".
export const OFFLINE_QUEUED = { offline: true } as const
export type OfflineQueued = typeof OFFLINE_QUEUED

// Intenta la mutación directa; si falla por red, ejecuta la estrategia
// offline (encolar + actualización optimista) y resuelve con OFFLINE_QUEUED.
export async function runWithOfflineFallback<T>(
  run: () => Promise<T>,
  onOffline: () => Promise<void> | void,
): Promise<T | OfflineQueued> {
  try {
    return await run()
  } catch (err) {
    if (isNetworkError(err)) {
      await onOffline()
      return OFFLINE_QUEUED
    }
    throw err
  }
}
