import type { QueryClient } from '@tanstack/react-query'

// Detección de errores de red y fallback offline para mutaciones.

export function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true
  if (err instanceof TypeError && /fetch|network|load/i.test(err.message)) {
    return true
  }
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  return /fetch failed|failed to fetch|network error|network request failed|load failed|ERR_INTERNET_DISCONNECTED/i.test(
    msg,
  )
}

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

// Intenta la mutación directa; si falla por red, ejecuta la estrategia
// offline (encolar + actualización optimista) y resuelve como éxito.
export async function runWithOfflineFallback<T>(
  run: () => Promise<T>,
  onOffline: () => Promise<void> | void,
): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (isNetworkError(err)) {
      await onOffline()
      return undefined as T
    }
    throw err
  }
}
