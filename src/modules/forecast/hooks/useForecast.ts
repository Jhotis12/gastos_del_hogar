import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { useMonthlySurpluses, useRunningBalance } from '@/modules/expenses/hooks/useExpenses'
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

// Historial de gastos VARIABLES (no recurrentes) de los últimos meses
// completos — la base para la mediana y los rangos p25/p75.
function useVariableHistory(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const from = shiftMonth(month, -MAX_VARIABLE_MONTHS)

  return useQuery({
    queryKey: ['expenses', 'history', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('household_id', householdId!)
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
    enabled: !!householdId,
  })
}

// Historial de ingresos extra (no nómina) de los últimos meses completos.
function useExtraIncomeHistory(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const from = shiftMonth(month, -MAX_VARIABLE_MONTHS)

  return useQuery({
    queryKey: ['incomes', 'history', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date')
        .eq('household_id', householdId!)
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
    enabled: !!householdId,
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
}

export function useForecast() {
  const currentMonth = currentMonthKey()
  const nextMonth = shiftMonth(currentMonth, 1)

  const queryClient = useQueryClient()
  const { data: surpluses, error: surplusesError, refetch: refetchSurpluses } = useMonthlySurpluses()
  const { data: recurring, error: recurringError, refetch: refetchRecurring } = useRecurringExpenses()
  const { salaries, isPending: salariesPending } = useSalaries(nextMonth)
  const { salaries: currentSalaries, isPending: currentSalariesPending } = useSalaries(currentMonth)
  const { data: runningBalance, error: balanceError, refetch: refetchBalance } = useRunningBalance(currentMonth)
  const { data: variableHistory, error: variableError, refetch: refetchVariable } = useVariableHistory(currentMonth)
  const { data: extraIncomeHistory, error: extraError, refetch: refetchExtra } = useExtraIncomeHistory(currentMonth)

  const error = [surplusesError, recurringError, balanceError, variableError, extraError].find(Boolean)
  const isLoading =
    salariesPending || currentSalariesPending ||
    (!surpluses && !surplusesError) ||
    (!recurring && !recurringError) ||
    (!runningBalance && !balanceError) ||
    (!variableHistory && !variableError) ||
    (!extraIncomeHistory && !extraError)

  const data = useMemo<ForecastData | null>(() => {
    if (error || surpluses === undefined || recurring === undefined || runningBalance === undefined) {
      return null
    }
    const fixed = fixedExpensesForMonth(recurring ?? [], nextMonth)
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
    const income = salaries?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0
    const extraValues = (extraIncomeHistory ?? [])
      .filter((m) => m.total > 0)
      .map((m) => m.total)
    const extraIncomeAvg =
      extraValues.length > 0
        ? extraValues.reduce((a, b) => a + b, 0) / extraValues.length
        : 0
    const surplus = monthlySurplusProjection(income + extraIncomeAvg, fixed.total, variable)
    const avg = averageFromSurpluses(surpluses ?? [], currentMonth)
    // Saldo base de la proyección: saldo disponible HOY + nóminas ya
    // programadas este mes (pay_date futura). Evita que el ahorro
    // proyectado salte en negativo justo antes del día de pago.
    const pendingIncome =
      (currentSalaries ?? [])
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
      historyMonths: (surpluses ?? []).slice(-6),
      hasEnoughHistory: variableValues.length >= 2,
    }
  }, [error, surpluses, recurring, runningBalance, nextMonth, variableHistory, extraIncomeHistory, salaries, currentSalaries, currentMonth])

  const refetch = () => {
    void refetchSurpluses()
    void refetchRecurring()
    void refetchBalance()
    void refetchVariable()
    void refetchExtra()
    void queryClient.invalidateQueries({ queryKey: ['salaries'] })
    void queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  return { data, error, isLoading, refetch }
}
