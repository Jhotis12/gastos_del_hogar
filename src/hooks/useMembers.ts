import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { effectiveSalariesForMonth } from '@/lib/salaries'
import { resizeAvatar } from '@/shared/lib/images'
import { errorMessage } from '@/shared/lib/utils'
import { useToast } from '@/shared/components/ui/Toast'
import { runWithOfflineFallback, invalidateIfOnline } from '@/shared/lib/offline/offlineSafe'
import { enqueueSalaryUpsert, enqueueSalaryDelete } from '@/shared/lib/offline/optimistic'
import type { EffectiveSalary, Profile, Salary } from '@/shared/lib/types'

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
// Derivación en memoria (no una query): un queryFn que leyera los datos de
// useAllSalaries/useMembers causaba una carrera al recargar la página — se
// cacheaba [] antes de que llegaran esos datos y la tarjeta del Dashboard
// quedaba vacía hasta un refetch posterior.
export function useSalaries(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const { data: all, isPending: allPending } = useAllSalaries()
  const { data: members, isPending: membersPending } = useMembers()

  const salaries = useMemo(
    () =>
      effectiveSalariesForMonth(all ?? [], members ?? [], month).filter(
        (s) => s.amount > 0,
      ) as EffectiveSalary[],
    [all, members, month],
  )

  return { salaries, isPending: !householdId || allPending || membersPending }
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
    mutationFn: ({
      amount,
      month,
      profileId,
      payDate,
    }: {
      amount: number
      month: string
      profileId?: string
      payDate?: string
    }) =>
      runWithOfflineFallback(
        async () => {
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
        () => {
          if (!user || !profile?.household_id) throw new Error('Sin hogar')
          const target = profileId ?? user.id
          enqueueSalaryUpsert(queryClient, profile.household_id, {
            amount,
            month,
            profileId: target,
            payDate: payDate ?? '',
          })
        },
      ),
    onSuccess: () => {
      invalidateIfOnline(queryClient, [
        ['salaries'],
        ['running-balance'],
        ['monthly-surpluses'],
      ])
    },
  })
}

export function useDeleteSalary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase.from('salaries').delete().eq('id', id)
          if (error) throw error
        },
        () => enqueueSalaryDelete(queryClient, id),
      ),
    onSuccess: () => {
      invalidateIfOnline(queryClient, [
        ['salaries'],
        ['running-balance'],
        ['monthly-surpluses'],
      ])
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

// Sube y asigna la foto de perfil: recorte cuadrado 256px, archivo aleatorio
// {userId}/uuid.jpg en el bucket público 'avatars', y limpia la anterior.
export function useUpdateAvatar() {
  const { user, profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!user) throw new Error('No autenticado')
      const blob = await resizeAvatar(file)
      const path = `${user.id}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', user.id)
      if (error) {
        await supabase.storage.from('avatars').remove([path]).catch(() => {})
        throw error
      }
      return path
    },
    onSuccess: async (path) => {
      const previous = profile?.avatar_path
      if (previous && previous !== path) {
        await supabase.storage.from('avatars').remove([previous]).catch(() => {})
      }
      await refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

// Quita la foto de perfil (columna a null + borra el archivo).
export function useRemoveAvatar() {
  const { user, profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_path: null })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: async () => {
      const previous = profile?.avatar_path
      if (previous) {
        await supabase.storage.from('avatars').remove([previous]).catch(() => {})
      }
      await refreshProfile()
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
