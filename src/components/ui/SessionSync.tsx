import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Procesa la sesión que Supabase entrega por el fragmento de la URL
// (#access_token=...&refresh_token=...&type=signup) en el flujo legacy de
// confirmación por correo. Debe montarse dentro del AuthProvider.
export default function SessionSync() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return

    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => {
        window.history.replaceState(null, '', window.location.pathname)
      })
      .catch(() => {
        window.history.replaceState(null, '', window.location.pathname)
      })
  }, [])

  return null
}
