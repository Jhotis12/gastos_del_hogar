import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env. ' +
      'La app no podrá conectar a Supabase hasta que se configuren.',
  )
}

// Sin red, los fetch a Supabase fallan en el navegador como "CORS request
// did not succeed" (no hay respuesta) → ruido en consola + ráfagas de
// reintentos de postgrest/auth (backoff 1s/2s/4s) por cada query. Mejor no
// intentar: rechazar al instante con un error de red, que es exactamente lo
// que runWithOfflineFallback y el networkMode offlineFirst esperan.
const offlineAwareFetch: typeof fetch = (input, init) => {
  if (!navigator.onLine) {
    return Promise.reject(new TypeError('Network request failed'))
  }
  return fetch(input, init)
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  { global: { fetch: offlineAwareFetch } },
)
