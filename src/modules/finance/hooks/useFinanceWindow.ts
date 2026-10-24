import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { todayISO } from '@/shared/lib/dates'
import { useAllSalaries } from '@/modules/members/hooks/useMembers'
import { financeWindow } from '@/modules/finance/lib/financeWindow'
import type { ExpenseWithRelations, IncomeWithRelations } from '@/shared/lib/types'

const WINDOW_EXPENSE_SELECT = `
  *,
  category:categories(id, name, color, icon),
  payer:profiles(id, full_name, avatar_path)
`

const WINDOW_INCOME_SELECT = `
  *,
  member:profiles(id, full_name, avatar_path)
`

export function useFinanceWindow(asOf: string = todayISO()) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id
  const {
    data: allSalaries,
    isPending: salariesPending,
    error: salariesError,
  } = useAllSalaries()

  const salaries = (allSalaries ?? []).filter(
    (salary) => salary.profile_id === memberId,
  )
  const window = financeWindow({
    payday: profile?.payday,
    salaries,
    asOf,
  })

  const query = useQuery({
    queryKey: [
      'finance-window',
      householdId,
      memberId,
      window.union.start,
      window.union.end,
    ],
    queryFn: async () => {
      const [expensesResult, incomesResult] = await Promise.all([
        supabase
          .from('expenses')
          .select(WINDOW_EXPENSE_SELECT)
          .eq('household_id', householdId!)
          .eq('paid_by', memberId!)
          .gte('expense_date', window.union.start)
          .lte('expense_date', window.union.end)
          .order('expense_date', { ascending: false }),
        supabase
          .from('incomes')
          .select(WINDOW_INCOME_SELECT)
          .eq('household_id', householdId!)
          .eq('member_id', memberId!)
          .gte('income_date', window.union.start)
          .lte('income_date', window.union.end)
          .order('income_date', { ascending: false }),
      ])

      if (expensesResult.error) throw expensesResult.error
      if (incomesResult.error) throw incomesResult.error

      return {
        expenses: expensesResult.data as ExpenseWithRelations[],
        incomes: incomesResult.data as IncomeWithRelations[],
      }
    },
    enabled: !!householdId && !!memberId && !salariesPending,
  })

  return {
    ...query,
    window,
    isPending: query.isPending || salariesPending,
    error: query.error ?? salariesError ?? null,
  }
}
