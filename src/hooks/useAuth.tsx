import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let active = true
    setProfileLoading(true)
    setProfileLoaded(false)

    const fetchProfile = async (attempt: number) => {
      // Valida que el usuario siga existiendo: si la cuenta fue eliminada,
      // la sesión es obsoleta → cerrar sesión para ir al login.
      const { data: userData } = await supabase.auth.getUser()
      if (!active) return
      if (!userData.user) {
        await supabase.auth.signOut()
        if (!active) return
        setProfile(null)
        setProfileLoading(false)
        setProfileLoaded(true)
        return
      }
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (!active) return
          if (!error && data) {
            setProfile(data)
            setProfileLoading(false)
            setProfileLoaded(true)
          } else {
            if (attempt < 2) {
              setTimeout(() => fetchProfile(attempt + 1), 1200)
            } else {
              setProfileLoading(false)
              setProfileLoaded(true)
            }
          }
        })
    }
    fetchProfile(0)

    return () => {
      active = false
    }
  }, [userId])

  const refreshProfile = async () => {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        profile,
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
