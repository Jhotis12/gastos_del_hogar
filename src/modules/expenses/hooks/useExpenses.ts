import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { runWithOfflineFallback, invalidateIfOnline } from '@/shared/lib/offline/offlineSafe'
import { LEDGER_INVALIDATION } from '@/shared/lib/queryInvalidation'
import {
  enqueueExpenseAdd,
  enqueueExpenseUpdate,
  enqueueExpenseDelete,
} from '@/shared/lib/offline/optimistic'
import type { Expense, ExpenseWithRelations } from '@/shared/lib/types'
import { shiftMonth } from '@/shared/lib/dates'

const EXPENSE_SELECT = `
  *,
  category:categories(id, name, color, icon),
  payer:profiles(id, full_name, avatar_path),
  recurring:recurring_expenses(id, description),
  receipt:receipts(*)
`

type ExpenseInput = {
  amount: number
  description: string
  category_id: string | null
  paid_by: string | null
  expense_date: string
  receipt_id?: string | null
}

export function useExpenses(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const firstDay = `${month.slice(0, 7)}-01`
  const nextMonth = `${shiftMonth(month, 1).slice(0, 7)}-01`

  return useQuery({
    queryKey: ['expenses', householdId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(EXPENSE_SELECT)
        .eq('household_id', householdId!)
        .gte('expense_date', firstDay)
        .lt('expense_date', nextMonth)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data as ExpenseWithRelations[]
    },
    enabled: !!householdId,
  })
}

export function useAddExpense() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ExpenseInput) => {
      // El mismo id se usa en el intento online y en el fallback offline:
      // si el servidor alcanzó a guardar pero se perdió la respuesta, el
      // replay encuentra la PK existente y no duplica la fila.
      const id = crypto.randomUUID()
      return runWithOfflineFallback(
        async () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          const { data, error } = await supabase
            .from('expenses')
            .insert({ ...input, id, household_id: profile.household_id })
            .select()
            .single()
          if (error) throw error
          return data as Expense
        },
        () => {
          if (!profile?.household_id) throw new Error('Sin hogar')
          enqueueExpenseAdd(queryClient, profile.household_id, input, id)
        },
      )
    },
    onSuccess: () => {
      invalidateIfOnline(queryClient, LEDGER_INVALIDATION.expenses)
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: ExpenseInput & { id: string }) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase.from('expenses').update(input).eq('id', id)
          if (error) throw error
        },
        () => enqueueExpenseUpdate(queryClient, id, input),
      ),
    onSuccess: () => {
      invalidateIfOnline(queryClient, LEDGER_INVALIDATION.expenses)
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      runWithOfflineFallback(
        async () => {
          const { error } = await supabase.from('expenses').delete().eq('id', id)
          if (error) throw error
        },
        () => enqueueExpenseDelete(queryClient, id),
      ),
    onSuccess: () => {
      invalidateIfOnline(queryClient, LEDGER_INVALIDATION.expenses)
    },
  })
}

