import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { invalidateLedger, LEDGER_INVALIDATION } from '@/shared/lib/queryInvalidation'
import type { SavingsGoal } from '@/shared/lib/types'

export function useSavingsGoals() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['savings', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('household_id', householdId!)
        .order('created_at')
      if (error) throw error
      return data as SavingsGoal[]
    },
    enabled: !!householdId,
  })
}

type SavingsInput = {
  name: string
  target_amount: number
  target_date: string | null
}

export function useAddSavingsGoal() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SavingsInput & { saved_amount: number }) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { error } = await supabase
        .from('savings_goals')
        .insert({ ...input, household_id: profile.household_id })
      if (error) throw error
    },
    onSuccess: () => invalidateLedger(queryClient, LEDGER_INVALIDATION.savings),
  })
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: SavingsInput & { id: string }) => {
      const { error } = await supabase
        .from('savings_goals')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateLedger(queryClient, LEDGER_INVALIDATION.savings),
  })
}

export function useAdjustSavingsGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, saved_amount }: { id: string; saved_amount: number }) => {
      const { error } = await supabase
        .from('savings_goals')
        .update({ saved_amount: Math.max(0, saved_amount) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateLedger(queryClient, LEDGER_INVALIDATION.savings),
  })
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateLedger(queryClient, LEDGER_INVALIDATION.savings),
  })
}

// ---------- Facturas escaneadas ----------
