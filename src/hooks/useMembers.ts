import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { effectiveSalariesForMonth } from '@/lib/salaries'
import { errorMessage } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { EffectiveSalary, Profile, Salary } from '@/lib/types'

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
      return data as Profile[]
    },
    enabled: !!householdId,
  })
}

export function useAllSalaries() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['salaries', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('household_id', householdId!)
        .order('month')
      if (error) throw error
      return data as Salary[]
    },
    enabled: !!householdId,
  })
}

// Salarios efectivos del mes: fila del mes o salario heredado del último
// mes anterior con registro. Solo los que tienen monto > 0.
export function useSalaries(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const { data: all } = useAllSalaries()
  const { data: members } = useMembers()

  return useQuery({
    queryKey: ['salaries', householdId, month, 'effective'],
    queryFn: () => {
      const effective = effectiveSalariesForMonth(all ?? [], members ?? [], month)
      return effective.filter((s) => s.amount > 0) as EffectiveSalary[]
    },
    enabled: !!householdId,
  })
}

// Filas crudas de salario del mes (para editar/eliminar la fila exacta)
export function useSalaryRows(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['salaries', householdId, month, 'rows'],
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
      payDate,
    }: {
      amount: number
      month: string
      profileId?: string
      payDate?: string
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
        pay_date: payDate,
      }

      if (existing.data) {
        const { error } = await supabase
          .from('salaries')
          .update({ amount, pay_date: payDate })
          .eq('id', existing.data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('salaries').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] })
      queryClient.invalidateQueries({ queryKey: ['running-balance'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-surpluses'] })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] })
      queryClient.invalidateQueries({ queryKey: ['running-balance'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-surpluses'] })
    },
  })
}

// Día de pago de una persona (1-31). Invalida miembros y salarios
// efectivos porque la fecha de pago heredada depende del día.
export function useUpdatePayday() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async ({ profileId, payday }: { profileId: string; payday: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ payday })
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['salaries'] })
      queryClient.invalidateQueries({ queryKey: ['running-balance'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-surpluses'] })
      toast.success(`Día de pago: ${vars.payday}`)
    },
    onError: (err) => toast.error(errorMessage(err)),
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
