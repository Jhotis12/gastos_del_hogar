import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import {
  createSavingsMovement,
  runDueSavings,
  savingsMovementsKey,
  savingsPlansKey,
  type SavingsMovementInput,
} from '@/modules/savings/lib/savingsApi'
import { invalidateLedger, LEDGER_INVALIDATION } from '@/shared/lib/queryInvalidation'
import type { SavingsMovement, SavingsPlan } from '@/shared/lib/types'

const MOVEMENT_SELECT = `
  *,
  member:profiles(id, full_name, avatar_path)
`

function invalidateSavings(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  invalidateLedger(queryClient, LEDGER_INVALIDATION.savings)
}

export function useSavingsMovements(goalId?: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: savingsMovementsKey(householdId, goalId),
    queryFn: async () => {
      let query = supabase
        .from('savings_movements')
        .select(MOVEMENT_SELECT)
        .eq('household_id', householdId!)

      if (goalId) query = query.eq('goal_id', goalId)

      const { data, error } = await query
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SavingsMovement[]
    },
    enabled: !!householdId,
  })
}

export function useCreateSavingsMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SavingsMovementInput) =>
      createSavingsMovement(supabase, input),
    onSuccess: () => invalidateSavings(queryClient),
  })
}

export function useArchiveSavingsGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('savings_goals')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateSavings(queryClient),
  })
}

export function useRunDueSavings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => runDueSavings(supabase),
    onSuccess: () => invalidateSavings(queryClient),
  })
}

export function useSavingsPlans() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: savingsPlansKey(householdId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_plans')
        .select('*')
        .eq('household_id', householdId!)
        .order('created_at')
      if (error) throw error
      return data as SavingsPlan[]
    },
    enabled: !!householdId,
  })
}

type SavingsPlanInput = {
  id?: string
  goal_id: string
  amount: number
  day_of_month: number
  is_active: boolean
}

export function useSaveSavingsPlan() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: SavingsPlanInput) => {
      if (!profile?.household_id || !profile.id) throw new Error('Sin hogar')

      if (id) {
        const { error } = await supabase
          .from('savings_plans')
          .update({
            amount: input.amount,
            day_of_month: input.day_of_month,
            is_active: input.is_active,
          })
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('savings_plans').insert({
          ...input,
          household_id: profile.household_id,
          member_id: profile.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => invalidateSavings(queryClient),
  })
}
