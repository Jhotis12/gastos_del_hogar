import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'

export function useHousehold() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['household', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!householdId,
  })
}

export function useCreateHousehold() {
  const { refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_household', {
        p_name: name.trim(),
      })
      if (error) throw error
      return data as string
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries()
    },
  })
}

export function useJoinHousehold() {
  const { user, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error('No autenticado')
      const { data: household, error } = await supabase.rpc(
        'get_household_by_code',
        { p_code: inviteCode.trim() },
      )
      if (error) throw error
      if (!household || household.length === 0) {
        throw new Error('Código de invitación inválido')
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ household_id: household[0].id })
        .eq('id', user.id)
      if (profileError) throw profileError

      await refreshProfile()
      await queryClient.invalidateQueries()
    },
  })
}
