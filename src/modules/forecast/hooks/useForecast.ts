import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/hooks/useAuth'
import { useMemberAvailable } from '@/modules/finance/hooks/useMemberAvailable'
import { useRecurringExpenses } from '@/modules/services/hooks/useRecurring'
import { useSalaries } from '@/modules/members/hooks/useMembers'
import {
  useSavingsPlans,
  useSavingsMovements,
} from '@/modules/savings/hooks/useSavingsMovements'
import { useSavingsGoals } from '@/modules/savings/hooks/useSavings'
import { supabase } from '@/shared/lib/supabase'
import { currentMonthKey, shiftMonth, todayISO } from '@/shared/lib/dates'
import { daysBetween, nextPaydayDate } from '@/shared/lib/periods'
import {
  MAX_VARIABLE_MONTHS,
  fixedCommitmentsUntil,
  projectCycle,
  savedAwayTotal,
  savingsCommitmentsUntil,
  variableBaseline,
} from '@/modules/forecast/lib/forecast'
import type {
  CycleProjection,
  FixedCommitment,
  ProjectionRange,
  SavingsCommitment,
  VariableExpense,
} from '@/modules/forecast/lib/forecast'

// Gastos personales de los últimos meses completos. Se traen también los
// recurrentes para que un mes con solo servicios cuente como variable 0 y no
// desaparezca de la ventana.
function useVariableHistory(month: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id
  const from = shiftMonth(month, -MAX_VARIABLE_MONTHS)

  return useQuery({
    queryKey: ['expenses', 'history', householdId, memberId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date, description, category_id, recurring_id')
        .eq('household_id', householdId!)
        .eq('paid_by', memberId!)
        .gte('expense_date', from)
        .lt('expense_date', month)
      if (error) throw error
      const rows = (data ?? []) as Array<{
        amount: number | string
        expense_date: string
        description: string | null
        category_id: string | null
        recurring_id: string | null
      }>
      return rows.map((row) => ({
        amount: Number(row.amount),
        expense_date: String(row.expense_date),
        description: row.description ?? '',
        category_id: row.category_id,
        recurring_id: row.recurring_id,
      })) as VariableExpense[]
    },
    enabled: !!householdId && !!memberId,
  })
}

// Ingresos extra registrados antes del próximo pago. No se inventa un
// promedio: solo suma lo que ya existe con fecha futura dentro del ciclo.
function useFutureIncomesUntil(from: string, to: string) {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  const memberId = profile?.id

  return useQuery({
    queryKey: ['incomes', 'future', householdId, memberId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date')
        .eq('household_id', householdId!)
        .eq('member_id', memberId!)
        .gt('income_date', from)
        .lt('income_date', to)
      if (error) throw error
      const rows = (data ?? []) as Array<{
        amount: number | string
        income_date: string
      }>
      return rows.reduce((sum, row) => sum + Number(row.amount), 0)
    },
    enabled: !!householdId && !!memberId && to > from,
  })
}

export interface ForecastData {
  today: string
  nextPayday: string
  remainingDays: number
  available: number | null
  incomeBefore: number
  nextSalary: number | null
  fixedCommitments: FixedCommitment[]
  fixedTotal: number
  savingsPending: SavingsCommitment[]
  savingsPendingTotal: number
  savingsAlreadyRun: SavingsCommitment[]
  savingsAlreadyRunTotal: number
  savedAway: number
  variable: ProjectionRange | null
  variableMonths: number
  variableDaily: number | null
  projection: CycleProjection
  unassignedRecurringCount: number
}

export function useForecast() {
  const { profile } = useAuth()
  const currentMonth = currentMonthKey()
  const nextMonth = shiftMonth(currentMonth, 1)
  const today = todayISO()
  const queryClient = useQueryClient()

  const {
    data: memberAvailable,
    error: availableError,
    refetch: refetchAvailable,
  } = useMemberAvailable(today)
  const {
    data: recurringAll,
    error: recurringError,
    refetch: refetchRecurring,
  } = useRecurringExpenses()
  const {
    data: plans,
    error: plansError,
    refetch: refetchPlans,
  } = useSavingsPlans()
  const {
    data: goals,
    error: goalsError,
    refetch: refetchGoals,
  } = useSavingsGoals()
  const {
    data: savingsMovements,
    error: savingsError,
    refetch: refetchSavings,
  } = useSavingsMovements()
  const { salaries: allCurrent, isPending: currentSalariesPending } =
    useSalaries(currentMonth)
  const { salaries: allNext, isPending: nextSalariesPending } =
    useSalaries(nextMonth)
  const {
    data: variableExpenses,
    error: variableError,
    refetch: refetchVariable,
  } = useVariableHistory(currentMonth)

  const myCurrent = useMemo(
    () => allCurrent.filter((salary) => salary.profile_id === profile?.id),
    [allCurrent, profile?.id],
  )
  const myNext = useMemo(
    () => allNext.filter((salary) => salary.profile_id === profile?.id),
    [allNext, profile?.id],
  )
  const salaryDates = useMemo(
    () => [...myCurrent, ...myNext],
    [myCurrent, myNext],
  )
  const nextPayday = useMemo(
    () =>
      nextPaydayDate({
        payday: profile?.payday,
        salaries: salaryDates,
        asOf: today,
      }),
    [profile?.payday, salaryDates, today],
  )
  const {
    data: futureIncome,
    error: futureIncomeError,
    refetch: refetchFutureIncome,
  } = useFutureIncomesUntil(today, nextPayday)

  const error = [
    availableError,
    recurringError,
    plansError,
    goalsError,
    savingsError,
    variableError,
    futureIncomeError,
  ].find(Boolean)

  const isLoading =
    currentSalariesPending ||
    nextSalariesPending ||
    (memberAvailable === undefined && !availableError) ||
    (recurringAll === undefined && !recurringError) ||
    (plans === undefined && !plansError) ||
    (goals === undefined && !goalsError) ||
    (savingsMovements === undefined && !savingsError) ||
    (variableExpenses === undefined && !variableError) ||
    (futureIncome === undefined && !futureIncomeError)

  const data = useMemo<ForecastData | null>(() => {
    const memberId = profile?.id
    if (
      error ||
      !memberId ||
      memberAvailable === undefined ||
      recurringAll === undefined ||
      plans === undefined ||
      goals === undefined ||
      savingsMovements === undefined ||
      variableExpenses === undefined ||
      futureIncome === undefined
    ) {
      return null
    }

    const fixedCommitments = fixedCommitmentsUntil(
      recurringAll,
      memberId,
      today,
      nextPayday,
    )
    const fixedTotal = fixedCommitments.reduce(
      (sum, item) => sum + item.amount,
      0,
    )
    const savings = savingsCommitmentsUntil(
      plans,
      goals,
      memberId,
      today,
      nextPayday,
    )
    const recurringMatchers = recurringAll
      .filter((service) => service.is_active && service.paid_by === memberId)
      .map((service) => ({
        description: service.description,
        category_id: service.category_id,
      }))
    const variable = variableBaseline(
      variableExpenses,
      currentMonth,
      recurringMatchers,
    )
    const salaryIncomes = [...myCurrent, ...myNext]
      .filter(
        (salary) =>
          salary.pay_date > today && salary.pay_date < nextPayday,
      )
      .reduce((sum, salary) => sum + Number(salary.amount), 0)
    const incomeBefore = salaryIncomes + Number(futureIncome ?? 0)
    const nextSalary =
      [...myCurrent, ...myNext].find(
        (salary) => salary.pay_date === nextPayday,
      )?.amount ?? null
    const savedAway = savedAwayTotal(
      goals,
      savingsMovements,
      memberId,
    )
    const remainingDays = Math.max(1, daysBetween(today, nextPayday))
    const projection = projectCycle({
      available: memberAvailable.available,
      incomeBefore,
      fixedTotal,
      savingsPendingTotal: savings.pendingTotal,
      variable: variable.range,
      remainingDays,
    })

    return {
      today,
      nextPayday,
      remainingDays,
      available: memberAvailable.available,
      incomeBefore,
      nextSalary: nextSalary === null ? null : Number(nextSalary),
      fixedCommitments,
      fixedTotal,
      savingsPending: savings.pending,
      savingsPendingTotal: savings.pendingTotal,
      savingsAlreadyRun: savings.alreadyRun,
      savingsAlreadyRunTotal: savings.alreadyRunTotal,
      savedAway: Math.max(0, savedAway),
      variable: variable.range,
      variableMonths: variable.months.length,
      variableDaily: projection.variableDaily,
      projection,
      unassignedRecurringCount: recurringAll.filter(
        (service) => service.is_active && service.paid_by === null,
      ).length,
    }
  }, [
    error,
    memberAvailable,
    recurringAll,
    plans,
    goals,
    savingsMovements,
    variableExpenses,
    futureIncome,
    profile?.id,
    today,
    nextPayday,
    currentMonth,
    myCurrent,
    myNext,
  ])

  const refetch = () => {
    void refetchAvailable()
    void refetchRecurring()
    void refetchPlans()
    void refetchGoals()
    void refetchSavings()
    void refetchVariable()
    void refetchFutureIncome()
    void queryClient.invalidateQueries({ queryKey: ['salaries'] })
    void queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  return { data, error, isLoading, refetch }
}
