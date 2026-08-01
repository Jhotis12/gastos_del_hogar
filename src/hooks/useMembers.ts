import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Salary } from '@/lib/types'

export function useMembers() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['members', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('household_id', householdId!)
        .order('full_name')
      if (error) throw error
      return data
    },
    enabled: !!householdId,
  })
}

export function useSalaries(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['salaries', householdId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('household_id', householdId!)
        .eq('month', month)
      if (error) throw error
      return data as Salary[]
    },
    enabled: !!householdId,
  })
}

export function useUpsertSalary() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      amount,
      month,
      profileId,
    }: {
      amount: number
      month: string
      profileId?: string
    }) => {
      if (!user || !profile?.household_id) throw new Error('Sin hogar')
      const target = profileId ?? user.id
      const existing = await supabase
        .from('salaries')
        .select('id')
        .eq('profile_id', target)
        .eq('month', month)
        .maybeSingle()

      const payload = {
        household_id: profile.household_id,
        profile_id: target,
        amount,
        month,
      }

      if (existing.data) {
        const { error } = await supabase
          .from('salaries')
          .update({ amount })
          .eq('id', existing.data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('salaries').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] })
      void vars
    },
  })
}

export function useDeleteSalary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salaries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salaries'] }),
  })
}


// ---------- Perfil y hogar ----------

export function useUpdateProfile() {
  const { user, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ full_name }: { full_name: string }) => {
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase
        .from('profiles')
        .update({ full_name })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      void refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useLeaveHousehold() {
  const { user, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase
        .from('profiles')
        .update({ household_id: null })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries()
    },
  })
}

export function useDeleteHousehold() {
  const { profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { error } = await supabase
        .from('households')
        .delete()
        .eq('id', profile.household_id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries()
    },
  })
}
