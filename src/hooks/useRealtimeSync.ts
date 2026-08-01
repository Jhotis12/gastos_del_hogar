import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

type RealtimeTable = {
  table: string
  filter: (householdId: string) => string
  invalidate: string[][]
  refreshProfile?: boolean
}

// Cambios que invalidan cada caché (además de la propia tabla)
const TABLES: RealtimeTable[] = [
  { table: 'expenses', filter: (id) => `household_id=eq.${id}`, invalidate: [['expenses'], ['receipts']] },
  { table: 'salaries', filter: (id) => `household_id=eq.${id}`, invalidate: [['salaries']] },
  { table: 'categories', filter: (id) => `household_id=eq.${id}`, invalidate: [['categories'], ['expenses']] },
  { table: 'category_budgets', filter: (id) => `household_id=eq.${id}`, invalidate: [['budgets']] },
  { table: 'recurring_expenses', filter: (id) => `household_id=eq.${id}`, invalidate: [['recurring'], ['expenses']] },
  { table: 'savings_goals', filter: (id) => `household_id=eq.${id}`, invalidate: [['savings']] },
  { table: 'receipts', filter: (id) => `household_id=eq.${id}`, invalidate: [['receipts'], ['expenses']] },
  { table: 'profiles', filter: (id) => `household_id=eq.${id}`, invalidate: [['members']], refreshProfile: true },
  { table: 'households', filter: (id) => `id=eq.${id}`, invalidate: [['household']], refreshProfile: true },
]

// Suscribe al canal Realtime del hogar: cualquier cambio de un miembro
// invalida las queries de React Query de los demás (sin recargar la página).
export function useRealtimeSync(householdId: string | null | undefined) {
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()

  // Ref estable para no resuscribir en cada render
  const refreshProfileRef = useRef(refreshProfile)
  refreshProfileRef.current = refreshProfile

  useEffect(() => {
    if (!householdId) return

    const channel = supabase.channel(`household-${householdId}`)

    for (const t of TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t.table, filter: t.filter(householdId) },
        () => {
          for (const key of t.invalidate) {
            queryClient.invalidateQueries({ queryKey: key })
          }
          if (t.refreshProfile) {
            void refreshProfileRef.current()
          }
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, queryClient])

  return null
}
