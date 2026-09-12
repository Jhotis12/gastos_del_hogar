// Clasificador puro de errores de red: no lee navigator.onLine (testeable).
// Detecta fallos de fetch/red que Supabase/postgrest/auth emiten cuando no hay internet
// o hay portal cautivo / proxy que responde no-JSON.
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch|network|load|cors/i.test(err.message)) {
    return true
  }
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  return /fetch failed|failed to fetch|network error|network request failed|load failed|ERR_INTERNET_DISCONNECTED|cors.*did not succeed|Failed to fetch/i.test(
    msg,
  )
}
