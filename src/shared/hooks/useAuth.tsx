import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase, supabaseUrl } from '@/shared/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/shared/lib/types'
import { clearPersistedCache } from '@/shared/lib/offline/persister'
import { isNetworkError } from '@/shared/lib/offline/isNetworkError'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  profileLoading: boolean
  profileLoaded: boolean
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  profileLoading: false,
  profileLoaded: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

// Clave canónica donde auth-js persiste la sesión: `sb-<ref>-auth-token`,
// con el ref = subdominio de la URL de Supabase (misma regla de supabase-js).
function computedAuthStorageKey(): string | null {
  try {
    const host = new URL(supabaseUrl ?? '').hostname.split('.')[0]
    return host ? `sb-${host}-auth-token` : null
  } catch {
    return null
  }
}

// Escaneo de respaldo: cubre orígenes que compartieron otra URL de Supabase
// (dev ↔ prod en el mismo origen) o claves de versiones previas.
function findAuthStorageKey(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return key
  }
  return null
}

function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.access_token && data?.user) {
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? null,
        expires_in: data.expires_in ?? 3600,
        expires_at: data.expires_at ?? null,
        token_type: data.token_type ?? 'bearer',
        user: data.user,
      } as Session
    }
  } catch {
    /* clave corrupta — se ignora */
  }
  return null
}

// Boot sin red: getSession() puede colgarse intentando refrescar el token.
// Si no responde a tiempo, leemos la sesión que supabase-js dejó en
// localStorage (clave "sb-*-auth-token"). Al volver a estar en línea,
// syncNow() restaura la sesión en memoria antes de drenar.
function readStoredSession(): Session | null {
  const computed = computedAuthStorageKey()
  if (computed) {
    const session = parseStoredSession(localStorage.getItem(computed))
    if (session) return session
  }
  const key = findAuthStorageKey()
  return key ? parseStoredSession(localStorage.getItem(key)) : null
}

// Re-persiste la sesión en localStorage en el formato que auth-js espera.
// Necesario cuando auth-js la borró al clasificar como fatal un fallo de
// refresh que en realidad fue de red (sin conexión real, portal cautivo…):
// sin esta copia, al volver en línea getSession() no encontraría nada que
// refrescar y la cola offline nunca se drenaría.
function persistSessionToStorage(session: Session): void {
  const key = computedAuthStorageKey() ?? findAuthStorageKey()
  if (!key) return
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        provider_token: session.provider_token,
        provider_refresh_token: session.provider_refresh_token,
        user: session.user,
      }),
    )
  } catch {
    /* storage lleno o inaccesible — se ignora */
  }
}

async function bootSession(): Promise<Session | null> {
  try {
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 2500)
      }),
    ])
    if (data.session) return data.session
  } catch {
    /* sin red — cae al respaldo local */
  }
  return readStoredSession()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // Última sesión conocida: los eventos de auth con sesión nula
  // (INITIAL_SESSION fallido / SIGNED_OUT) llegan sin datos, así que el
  // respaldo para restaurar la sesión ante un fallo de refresh es esta ref.
  const sessionRef = useRef<Session | null>(null)
  // Cierre de sesión explícito desde la app: un SIGNED_OUT posterior no
  // debe "resucitar" la sesión vía el respaldo offline.
  const signOutRef = useRef(false)

  const applySession = (s: Session | null) => {
    sessionRef.current = s
    setSession(s)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    void bootSession().then((s) => {
      if (!active) return
      applySession(s)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        applySession(newSession)
        return
      }

      // Sesión nula: un INITIAL_SESSION fallido (token expirado sin red)
      // o un SIGNED_OUT por un refresh que auth-js consideró fatal. Ambos
      // suceden sin red real, y auth-js solo preserva la sesión ante
      // errores puramente de red (AuthRetryableFetchError); un portal
      // cautivo, un proxy o un WiFi "conectado" sin internet responden
      // con algo no-JSON/4xx y auth-js borra la sesión. Aquí se restaura
      // la última sesión conocida y se re-persiste: al reconectar, el
      // refresh (syncNow/heartbeat) la renueva sola y la cola drena.
      if (signOutRef.current) {
        signOutRef.current = false
        applySession(null)
        return
      }

      const fallback = sessionRef.current ?? readStoredSession()
      if (!fallback) {
        applySession(null)
        return
      }

      if (!navigator.onLine) {
        if (import.meta.env.DEV) console.debug('[auth] restored session after null event (offline)', _event)
        applySession(fallback)
        persistSessionToStorage(fallback)
        return
      }

      // Con red, confirmar contra el servidor antes de cerrar sesión:
      // solo una respuesta explícita (sesión revocada / 401) cierra; los
      // fallos de red (isNetworkError) o AuthRetryableFetchError se tratan
      // como transitorios aunque navigator.onLine sea true (portal cautivo).
      try {
        const { data, error: getUserError } = await supabase.auth.getUser()
        if (!active) return
        if (getUserError && (isAuthRetryableFetchError(getUserError) || isNetworkError(getUserError))) {
          if (import.meta.env.DEV) console.debug('[auth] restored session after null event (retryable getUser)', _event, getUserError)
          applySession(fallback)
          persistSessionToStorage(fallback)
          return
        }
        if (data.user) {
          // getUser pudo refrescar el token: preferir lo que auth-js
          // acaba de guardar en storage a la sesión que traíamos.
          const restored = readStoredSession() ?? fallback
          applySession(restored)
          persistSessionToStorage(restored)
        } else {
          applySession(null)
        }
      } catch (err) {
        if (!active) return
        if (import.meta.env.DEV) console.debug('[auth] restored session after null event (catch)', _event, err)
        // Cualquier excepción en getUser se considera transitoria si es de red
        if (isNetworkError(err) || isAuthRetryableFetchError(err as Error)) {
          applySession(fallback)
          persistSessionToStorage(fallback)
        } else {
          // Incluso errores no retryable en catch se tratan como transitorios
          // para no cerrar sesión por un fallo de red mal clasificado
          applySession(fallback)
          persistSessionToStorage(fallback)
        }
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  // El perfil es una query persistida (networkMode offlineFirst): sin red
  // se sirve el último perfil conocido de IndexedDB y los guards no se
  // quedan cargando para siempre.
  const {
    data: profile,
    isPending: profileLoading,
    isFetched: profileFetched,
    refetch,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      // Valida que el usuario siga existiendo. Un fallo de RED
      // (AuthRetryableFetchError / isNetworkError) NO cierra la sesión: sin
      // validación se continúa y la query se pausa (offlineFirst) hasta
      // reconectar. Solo error no retryable y no de red cierra.
      const { data: userData, error: userError } = await supabase.auth
        .getUser()
        .catch((err) => ({ data: { user: null }, error: err as Error }))
      if (!userData.user && userError && !isAuthRetryableFetchError(userError) && !isNetworkError(userError)) {
        // Sesión obsoleta confirmada por el servidor → ir al login.
        await supabase.auth.signOut().catch(() => {})
        return null
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!userId,
    retry: 1,
  })

  const profileLoaded = profileFetched || profile !== undefined || !userId

  const refreshProfile = async () => {
    await refetch()
  }

  const signOut = async () => {
    signOutRef.current = true
    await supabase.auth.signOut()
    applySession(null)
    queryClient.clear()
    await clearPersistedCache()
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        profile: profile ?? null,
        profileLoading,
        profileLoaded,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
