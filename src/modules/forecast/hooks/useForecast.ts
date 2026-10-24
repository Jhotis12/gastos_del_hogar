import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { useMemberAvailable } from '@/modules/finance/hooks/useMemberAvailable'
import { usePersonalMonthlyHistory } from '@/modules/finance/hooks/usePersonalMonthlyHistory'
import { useRecurringExpenses } from '@/modules/services/hooks/useRecurring'
import { useSalaries } from '@/modules/members/hooks/useMembers'
import { supabase } from '@/shared/lib/supabase'
import { currentMonthKey, shiftMonth, todayISO } from '@/shared/lib/dates'
import {
  MAX_VARIABLE_MONTHS,
  averageFromSurpluses,
  fixedExpensesForMonth,
  monthlySurplusProjection,
  rangeFromMonthly,
} from '@/modules/forecast/lib/forecast'
import type { ProjectionRange } from '@/modules/forecast/lib/forecast'

// Historial personal de gastos VARIABLES (no recurrentes) de los últimos
// meses completos — la base para la mediana y los rangos p25/p75.
function useVariableHistory(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id
  const from = shiftMonth(month, -MAX_VARIABLE_MONTHS)

  return useQuery({
    queryKey: ['expenses', 'history', householdId, memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('household_id', householdId!)
        .eq('paid_by', memberId!)
        .is('recurring_id', null)
        .gte('expense_date', from)
        .lt('expense_date', month)
      if (error) throw error
      const byMonth = new Map<string, number>()
      for (const e of data ?? []) {
        const key = `${String(e.expense_date).slice(0, 7)}-01`
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(e.amount))
      }
      return [...byMonth.entries()]
        .map(([monthKey, total]) => ({ month: monthKey, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
    },
    enabled: !!householdId && !!memberId,
  })
}

// Historial personal de ingresos extra (no nómina) de los últimos meses.
function useExtraIncomeHistory(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id
  const from = shiftMonth(month, -MAX_VARIABLE_MONTHS)

  return useQuery({
    queryKey: ['incomes', 'history', householdId, memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date')
        .eq('household_id', householdId!)
        .eq('member_id', memberId!)
        .gte('income_date', from)
        .lt('income_date', month)
      if (error) throw error
      const byMonth = new Map<string, number>()
      for (const i of data ?? []) {
        const key = `${String(i.income_date).slice(0, 7)}-01`
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(i.amount))
      }
      return [...byMonth.entries()]
        .map(([monthKey, total]) => ({ month: monthKey, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
    },
    enabled: !!householdId && !!memberId,
  })
}

export interface ForecastData {
  nextMonth: string
  baseBalance: number
  fixedExpenses: number
  fixedItems: { description: string; amount: number }[]
  variable: ProjectionRange | null
  totalExpense: ProjectionRange | null
  income: number
  extraIncomeAvg: number
  surplus: ProjectionRange | null
  avg: { income: number; expenses: number; surplus: number } | null
  balance: number
  historyMonths: { month: string; expenses: number }[]
  hasEnoughHistory: boolean
  hasIncomeBase: boolean
}

export function useForecast() {
  const { profile } = useAuth()
  const currentMonth = currentMonthKey()
  const nextMonth = shiftMonth(currentMonth, 1)

  const queryClient = useQueryClient()
  const { data: history, error: historyError, refetch: refetchHistory } = usePersonalMonthlyHistory()
  const { data: memberAvailable, error: balanceError, refetch: refetchBalance } = useMemberAvailable(todayISO())
  const { data: recurringAll, error: recurringError, refetch: refetchRecurring } = useRecurringExpenses()
  const { salaries: allNext, isPending: salariesPending } = useSalaries(nextMonth)
  const { salaries: allCurrent, isPending: currentSalariesPending } = useSalaries(currentMonth)
  const { data: variableHistory, error: variableError, refetch: refetchVariable } = useVariableHistory(currentMonth)
  const { data: extraIncomeHistory, error: extraError, refetch: refetchExtra } = useExtraIncomeHistory(currentMonth)

  const recurring = (recurringAll ?? []).filter((item) => item.paid_by === profile?.id)
  const salaries = (allNext ?? []).filter((salary) => salary.profile_id === profile?.id)
  const currentSalaries = (allCurrent ?? []).filter((salary) => salary.profile_id === profile?.id)
  const surpluses = history?.map((row) => ({
    month: row.month,
    income: row.income,
    expenses: row.expenses,
    surplus: row.free,
  }))
  const runningBalance = memberAvailable?.available ?? null

  const error = [historyError, recurringError, balanceError, variableError, extraError].find(Boolean)
  const isLoading =
    salariesPending || currentSalariesPending ||
    (history === undefined && !historyError) ||
    (recurringAll === undefined && !recurringError) ||
    (memberAvailable === undefined && !balanceError) ||
    (variableHistory === undefined && !variableError) ||
    (extraIncomeHistory === undefined && !extraError)

  const data = useMemo<ForecastData | null>(() => {
    if (error || history === undefined || recurringAll === undefined || memberAvailable === undefined) {
      return null
    }
    const fixed = fixedExpensesForMonth(recurring, nextMonth)
    const variableValues = (variableHistory ?? [])
      .filter((m) => m.total > 0)
      .map((m) => m.total)
    const variable = rangeFromMonthly(variableValues)
    const totalExpense = variable
      ? {
          median: fixed.total + variable.median,
          low: fixed.total + variable.low,
          high: fixed.total + variable.high,
        }
      : null
    const income = salaries.reduce((sum, s) => sum + Number(s.amount), 0)
    const extraValues = (extraIncomeHistory ?? [])
      .filter((m) => m.total > 0)
      .map((m) => m.total)
    const extraIncomeAvg =
      extraValues.length > 0
        ? extraValues.reduce((a, b) => a + b, 0) / extraValues.length
        : 0
    const surplus = monthlySurplusProjection(income + extraIncomeAvg, fixed.total, variable)
    const avg = averageFromSurpluses(surpluses ?? [], currentMonth)
    // Disponible personal HOY + nóminas personales ya programadas este mes.
    const pendingIncome =
      currentSalaries
        .filter((s) => s.pay_date > todayISO())
        .reduce((sum, s) => sum + Number(s.amount), 0)
    const baseBalance = Number(runningBalance ?? 0) + pendingIncome

    return {
      nextMonth,
      baseBalance,
      fixedExpenses: fixed.total,
      fixedItems: fixed.items,
      variable,
      totalExpense,
      income,
      extraIncomeAvg,
      surplus,
      avg,
      balance: Number(runningBalance ?? 0),
      historyMonths: (history ?? []).slice(-6).map((row) => ({
        month: row.month,
        expenses: row.expenses,
      })),
      hasEnoughHistory: variableValues.length >= 2,
      hasIncomeBase: memberAvailable.available !== null,
    }
  }, [error, history, recurringAll, recurring, memberAvailable, runningBalance, nextMonth, variableHistory, extraIncomeHistory, salaries, currentSalaries, currentMonth, surpluses])

  const refetch = () => {
    void refetchHistory()
    void refetchRecurring()
    void refetchBalance()
    void refetchVariable()
    void refetchExtra()
    void queryClient.invalidateQueries({ queryKey: ['salaries'] })
    void queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  return { data, error, isLoading, refetch }
}
