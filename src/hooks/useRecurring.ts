import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Frequency, RecurringExpenseWithRelations } from '@/lib/types'
import { shiftMonth } from '@/lib/dates'

const RECURRING_SELECT = `
  *,
  category:categories(id, name, color, icon),
  payer:profiles(id, full_name)
`

type RecurringInput = {
  amount: number
  description: string
  category_id: string | null
  paid_by: string | null
  frequency: Frequency
  next_due_date: string
}

export function useRecurringExpenses() {
  const { profile } = useAuth()
  const householdId = profile?.household_id

  return useQuery({
    queryKey: ['recurring', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select(RECURRING_SELECT)
        .eq('household_id', householdId!)
        .order('is_active', { ascending: false })
        .order('next_due_date')
      if (error) throw error
      return data as RecurringExpenseWithRelations[]
    },
    enabled: !!householdId,
  })
}

export function useAddRecurring() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecurringInput) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { error } = await supabase
        .from('recurring_expenses')
        .insert({ ...input, household_id: profile.household_id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useToggleRecurring() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: RecurringInput & { id: string }) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useApplyRecurringOne(month: string) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recurringId: string) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { data, error } = await supabase.rpc('apply_recurring_expense', {
        p_recurring_id: recurringId,
        p_month: `${month.slice(0, 7)}-01`,
      })
      if (error) throw error
      return (data ?? 0) as number
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
  })
}

export function usePendingRecurring(month: string) {
  const { data: recurring } = useRecurringExpenses()
  const lastDay = `${shiftMonth(month, 1).slice(0, 7)}-01`

  if (!recurring) return 0
  return recurring.filter(
    (r) => r.is_active && r.next_due_date < lastDay,
  ).length
}

// ---------- Metas de ahorro ----------
