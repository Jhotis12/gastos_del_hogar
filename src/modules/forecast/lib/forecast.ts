// Motor de proyección del ciclo actual (funciones puras, sin I/O).
//
// Modelo:
//   1. Ventana: desde hoy hasta el día anterior al próximo pago.
//   2. Compromisos: servicios recurrentes y aportes de autoahorro que vencen
//      dentro de la ventana.
//   3. Variables: mediana + rango p25/p75 de los gastos NO recurrentes de
//      hasta 6 meses completos, escalado a los días que faltan.
//   4. Veredicto: el rango pesimista/optimista decide si el disponible alcanza.
import type {
  RecurringExpenseWithRelations,
  SavingsGoal,
  SavingsPlan,
} from '../../../shared/lib/types.ts'
import { daysInMonth, shiftMonth } from '../../../shared/lib/dates.ts'

export interface ProjectionRange {
  median: number
  low: number
  high: number
}

export interface VariableMonth {
  month: string
  total: number
}

export interface VariableExpense {
  amount: number
  expense_date: string
  description: string
  category_id: string | null
  recurring_id?: string | null
}

export interface RecurringMatcher {
  description: string
  category_id: string | null
}

export interface FixedCommitment {
  id: string
  description: string
  amount: number
  dueDate: string
  overdue: boolean
}

export interface SavingsCommitment {
  id: string
  goalId: string
  goalName: string
  amount: number
  dueDate: string
  overdue: boolean
}

export interface SavingsCommitmentSummary {
  pending: SavingsCommitment[]
  alreadyRun: SavingsCommitment[]
  pendingTotal: number
  alreadyRunTotal: number
}

export type CycleVerdict =
  | 'alcanza'
  | 'no_alcanza'
  | 'ajustado'
  | 'preliminar'
  | 'sin_base'

export interface CycleProjection {
  spendable: number | null
  dailyBudget: number | null
  variableDaily: number | null
  variable: ProjectionRange | null
  variableScaled: ProjectionRange | null
  expected: ProjectionRange | null
  verdict: CycleVerdict
}

export interface ProjectCycleInput {
  available: number | null
  incomeBefore: number
  fixedTotal: number
  savingsPendingTotal: number
  variable: ProjectionRange | null
  remainingDays: number
}

export const MAX_VARIABLE_MONTHS = 6
export const MIN_VARIABLE_MONTHS = 2
export const AVG_DAYS_PER_MONTH = 30.44

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Percentil de una lista (p entre 0 y 1), con interpolación lineal simple.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// Rango p25/p75 (rango intercuartil) sobre los montos mensuales.
export function rangeFromMonthly(values: number[]): ProjectionRange | null {
  if (values.length < MIN_VARIABLE_MONTHS) return null
  return {
    median: median(values),
    low: percentile(values, 0.25),
    high: percentile(values, 0.75),
  }
}

export function variableRangeFromMonths(
  months: VariableMonth[],
): ProjectionRange | null {
  return rangeFromMonthly(months.map((month) => month.total))
}

// Meses completos con datos, desde el primero hasta el mes anterior al actual,
// con tope de `maxMonths`. Los huecos se rellenan en variableBaseline.
export function variableMonthsForExpenses(
  expenses: VariableExpense[],
  currentMonth: string,
  maxMonths = MAX_VARIABLE_MONTHS,
): string[] {
  const complete = new Set<string>()
  for (const expense of expenses) {
    const key = `${expense.expense_date.slice(0, 7)}-01`
    if (key < currentMonth) complete.add(key)
  }
  if (complete.size === 0) return []

  const first = [...complete].sort()[0]
  const lastComplete = shiftMonth(currentMonth, -1)
  const earliest = shiftMonth(lastComplete, -(maxMonths - 1))
  const start = first > earliest ? first : earliest
  const months: string[] = []
  for (let month = start; month <= lastComplete; month = shiftMonth(month, 1)) {
    months.push(month)
  }
  return months
}

function normalizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function matchesRecurring(
  expense: VariableExpense,
  recurring: RecurringMatcher[],
): boolean {
  if (recurring.length === 0) return false
  const description = normalizeDescription(expense.description)
  return recurring.some((service) => {
    const serviceDescription = normalizeDescription(service.description)
    if (description && serviceDescription) {
      return description === serviceDescription
    }
    return (
      expense.category_id !== null &&
      expense.category_id === service.category_id
    )
  })
}

// Baseline variable: meses completos con ceros y sin doble conteo de gastos
// que hoy están representados por un servicio recurrente.
export function variableBaseline(
  expenses: VariableExpense[],
  currentMonth: string,
  recurring: RecurringMatcher[] = [],
  maxMonths = MAX_VARIABLE_MONTHS,
): { months: VariableMonth[]; range: ProjectionRange | null } {
  const monthKeys = variableMonthsForExpenses(expenses, currentMonth, maxMonths)
  const totals = new Map(monthKeys.map((month) => [month, 0]))
  for (const expense of expenses) {
    const key = `${expense.expense_date.slice(0, 7)}-01`
    if (!totals.has(key)) continue
    if (expense.recurring_id) continue
    if (matchesRecurring(expense, recurring)) continue
    totals.set(key, (totals.get(key) ?? 0) + Number(expense.amount))
  }
  const months = monthKeys.map((month) => ({
    month,
    total: totals.get(month) ?? 0,
  }))
  return { months, range: variableRangeFromMonths(months) }
}

export function scaleRangeToDays(
  range: ProjectionRange,
  remainingDays: number,
): ProjectionRange {
  const factor = Math.max(0, remainingDays) / AVG_DAYS_PER_MONTH
  return {
    median: range.median * factor,
    low: range.low * factor,
    high: range.high * factor,
  }
}

export function fixedCommitmentsUntil(
  recurring: RecurringExpenseWithRelations[],
  memberId: string,
  asOf: string,
  nextPayday: string,
): FixedCommitment[] {
  const today = asOf.slice(0, 10)
  return recurring
    .filter(
      (service) =>
        service.is_active &&
        service.paid_by === memberId &&
        service.next_due_date <= nextPayday,
    )
    .map((service) => ({
      id: service.id,
      description: service.description,
      amount: Number(service.amount),
      dueDate: service.next_due_date,
      overdue: service.next_due_date < today,
    }))
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.description.localeCompare(b.description),
    )
}

function planDateForMonth(dayOfMonth: number, month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const last = daysInMonth(year ?? 1970, (monthNumber ?? 1) - 1)
  const day = Math.min(Math.max(Math.trunc(dayOfMonth), 1), last)
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Aportes de autoahorro dentro de la ventana. Los que ya se ejecutaron se
// devuelven aparte para mostrarlos como "ahorro ya apartado" sin restarlos.
export function savingsCommitmentsUntil(
  plans: SavingsPlan[],
  goals: SavingsGoal[],
  memberId: string,
  asOf: string,
  nextPayday: string,
): SavingsCommitmentSummary {
  const today = asOf.slice(0, 10)
  const currentMonth = `${today.slice(0, 7)}-01`
  const followingMonth = shiftMonth(currentMonth, 1)
  const goalById = new Map(goals.map((goal) => [goal.id, goal]))
  const pending: SavingsCommitment[] = []
  const alreadyRun: SavingsCommitment[] = []

  for (const plan of plans) {
    if (!plan.is_active || plan.member_id !== memberId) continue
    const goal = goalById.get(plan.goal_id)
    if (goal?.archived_at) continue
    if (
      goal &&
      Number(goal.saved_amount) >= Number(goal.target_amount)
    ) {
      continue
    }

    const startMonth = `${plan.start_month.slice(0, 7)}-01`
    const lastRun = plan.last_run_month
      ? `${plan.last_run_month.slice(0, 7)}-01`
      : null

    for (const month of [currentMonth, followingMonth]) {
      if (month < startMonth) continue
      const dueDate = planDateForMonth(plan.day_of_month, month)
      if (dueDate >= nextPayday) continue

      const ranThisMonth = lastRun !== null && lastRun >= month
      const entry: SavingsCommitment = {
        id: `${plan.id}:${month}`,
        goalId: plan.goal_id,
        goalName: goal?.name || 'Meta de ahorro',
        amount: Number(plan.amount),
        dueDate,
        overdue: !ranThisMonth && dueDate < today,
      }
      if (ranThisMonth) alreadyRun.push(entry)
      else pending.push(entry)
    }
  }

  const byDueDate = (a: SavingsCommitment, b: SavingsCommitment) =>
    a.dueDate.localeCompare(b.dueDate) || a.goalName.localeCompare(b.goalName)
  pending.sort(byDueDate)
  alreadyRun.sort(byDueDate)

  return {
    pending,
    alreadyRun,
    pendingTotal: pending.reduce((sum, item) => sum + item.amount, 0),
    alreadyRunTotal: alreadyRun.reduce((sum, item) => sum + item.amount, 0),
  }
}

export interface SavingsMovementLike {
  member_id: string | null
  goal_id: string
  amount: number
}

// Ahorro ya apartado: saldo de mis metas personales (incluye aperturas) más
// mis movimientos netos en metas compartidas. No suma dos veces los movimientos
// de una meta personal, porque su saldo ya los refleja.
export function savedAwayTotal(
  goals: SavingsGoal[],
  movements: SavingsMovementLike[],
  memberId: string,
): number {
  const goalOwner = new Map(goals.map((goal) => [goal.id, goal.owner_id]))
  const personal = goals
    .filter((goal) => goal.owner_id === memberId)
    .reduce((sum, goal) => sum + Number(goal.saved_amount), 0)
  const shared = movements
    .filter(
      (movement) =>
        movement.member_id === memberId &&
        goalOwner.get(movement.goal_id) === null,
    )
    .reduce((sum, movement) => sum + Number(movement.amount), 0)
  return Math.max(0, personal + shared)
}

export function dailyBudget(spendable: number, remainingDays: number): number {
  return spendable / Math.max(1, remainingDays)
}

export function projectCycle(input: ProjectCycleInput): CycleProjection {
  const remainingDays = Math.max(1, input.remainingDays)
  const variableDaily = input.variable
    ? input.variable.median / AVG_DAYS_PER_MONTH
    : null

  if (input.available === null) {
    return {
      spendable: null,
      dailyBudget: null,
      variableDaily,
      variable: input.variable,
      variableScaled: null,
      expected: null,
      verdict: 'sin_base',
    }
  }

  const spendable =
    input.available +
    input.incomeBefore -
    input.fixedTotal -
    input.savingsPendingTotal

  if (!input.variable) {
    return {
      spendable,
      dailyBudget: dailyBudget(spendable, remainingDays),
      variableDaily,
      variable: null,
      variableScaled: null,
      expected: { median: spendable, low: spendable, high: spendable },
      verdict: 'preliminar',
    }
  }

  const scaled = scaleRangeToDays(input.variable, remainingDays)
  const expected = {
    median: spendable - scaled.median,
    low: spendable - scaled.high,
    high: spendable - scaled.low,
  }
  const verdict: CycleVerdict =
    expected.low >= 0
      ? 'alcanza'
      : expected.high < 0
        ? 'no_alcanza'
        : 'ajustado'

  return {
    spendable,
    dailyBudget: dailyBudget(spendable, remainingDays),
    variableDaily,
    variable: input.variable,
    variableScaled: scaled,
    expected,
    verdict,
  }
}

