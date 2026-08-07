import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/shared/lib/types'
import { clearPersistedCache } from '@/shared/lib/offline/persister'

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

// Boot sin red: getSession() puede colgarse intentando refrescar el token.
// Si no responde a tiempo, leemos la sesión que supabase-js dejó en
// localStorage (claves "sb-*-auth-token"). Al volver a estar en línea,
// syncNow() restaura la sesión en memoria antes de drenar.
function readStoredSession(): Session | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? '')
      if (raw?.access_token && raw?.user) {
        return {
          access_token: raw.access_token,
          refresh_token: raw.refresh_token ?? null,
          expires_in: raw.expires_in ?? 3600,
          expires_at: raw.expires_at ?? null,
          token_type: raw.token_type ?? 'bearer',
          user: raw.user,
        } as Session
      }
    } catch {
      /* clave corrupta — se ignora */
    }
  }
  return null
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

  useEffect(() => {
    let active = true
    void bootSession().then((s) => {
      if (!active) return
      setSession(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
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
      // (AuthRetryableFetchError) NO cierra la sesión: sin validación se
      // continúa y la query se pausa (offlineFirst) hasta reconectar.
      const { data: userData, error: userError } = await supabase.auth
        .getUser()
        .catch(() => ({ data: { user: null }, error: null }))
      if (!userData.user && userError && !isAuthRetryableFetchError(userError)) {
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
    await supabase.auth.signOut()
    setSession(null)
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
