import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { runWithOfflineFallback, invalidateIfOnline } from '@/shared/lib/offline/offlineSafe'
import {
  enqueueIncomeAdd,
  enqueueIncomeUpdate,
  enqueueIncomeDelete,
} from '@/shared/lib/offline/optimistic'
import { shiftMonth } from '@/shared/lib/dates'
import type { Income, IncomeWithRelations } from '@/shared/lib/types'

const INCOME_SELECT = `
  *,
  member:profiles(id, full_name, avatar_path)
`

type IncomeInput = {
  amount: number
  description: string
  member_id: string | null
  income_date: string
}

export function useIncomes(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const firstDay = `${month.slice(0, 7)}-01`
  const nextMonth = `${shiftMonth(month, 1).slice(0, 7)}-01`

  return useQuery({
    queryKey: ['incomes', householdId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select(INCOME_SELECT)
        .eq('household_id', householdId!)
        .gte('income_date', firstDay)
        .lt('income_date', nextMonth)
        .order('income_date', { ascending: false })
      if (error) throw error
      return data as IncomeWithRelations[]
    },
    enabled: !!householdId,
  })
}

// El dinero extra entra al saldo disponible y a los sobrantes por mes
function invalidateIncomeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateIfOnline(queryClient, [
    ['incomes'],
    ['running-balance'],
    ['monthly-surpluses'],
  ])
}

export function useAddIncome() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: IncomeInput) =>
      runWithOfflineFallback(
        async () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          const { data, error } = await supabase
            .from('incomes')
            .insert({ ...input, id: crypto.randomUUID(), household_id: profile.household_id })
            .select()
            .single()
          if (error) throw error
          return data as Income
        },
        () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          enqueueIncomeAdd(queryClient, profile.household_id, input)
        },
      ),
    onSuccess: () => invalidateIncomeQueries(queryClient),
  })
}

export function useUpdateIncome() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: IncomeInput & { id: string }) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase.from('incomes').update(input).eq('id', id)
          if (error) throw error
        },
        () => enqueueIncomeUpdate(queryClient, id, input),
      ),
    onSuccess: () => invalidateIncomeQueries(queryClient),
  })
}

export function useDeleteIncome() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase.from('incomes').delete().eq('id', id)
          if (error) throw error
        },
        () => enqueueIncomeDelete(queryClient, id),
      ),
    onSuccess: () => invalidateIncomeQueries(queryClient),
  })
}
