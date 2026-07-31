import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useSalaries } from '@/hooks/useMembers'
import type { Expense, ExpenseWithRelations } from '@/lib/types'
import { shiftMonth } from '@/lib/dates'

const EXPENSE_SELECT = `
  *,
  category:categories(id, name, color, icon),
  payer:profiles(id, full_name),
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
    mutationFn: async (input: ExpenseInput) => {
      if (!profile?.household_id) throw new Error('Sin hogar')
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...input, household_id: profile.household_id })
        .select()
        .single()
      if (error) throw error
      return data as Expense
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id: string }) => {
      const { error } = await supabase.from('expenses').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useSummary(month: string) {
  const { data: salaries } = useSalaries(month)
  const { data: expenses } = useExpenses(month)

  const totalIncome =
    salaries?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0
  const totalExpenses =
    expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0
  const balance = totalIncome - totalExpenses
  const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0

  return { totalIncome, totalExpenses, balance, expenseRatio }
}
