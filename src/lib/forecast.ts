// Motor de proyección financiera (funciones puras, sin I/O).
//
// Modelo de 3 capas:
//   1. Fijos deterministas: servicios recurrentes con next_due_date en el mes
//      (el bimestral/cuatrimestral/anual solo cuenta el mes que le toca) +
//      nóminas efectivas del mes (heredadas si no hay fila).
//   2. Variables: mediana + rangos (p25/p75) de los gastos NO recurrentes de
//      los últimos meses completos. La mediana es robusta a gastos one-off.
//   3. Ingresos extra (no nómina): promedio de los últimos meses completos.
import type { MonthlySurplus } from '@/hooks/useExpenses'
import type { RecurringExpenseWithRelations } from '@/shared/lib/types'
import { shiftMonth } from '@/shared/lib/dates'

export interface ProjectionRange {
  median: number
  low: number
  high: number
}

export interface FixedExpenseItem {
  description: string
  amount: number
}

export const MAX_VARIABLE_MONTHS = 6
export const MIN_VARIABLE_MONTHS = 2

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

// Gastos fijos del mes: servicios activos cuya próxima fecha de pago cae
// dentro del mes. Sin prorrateo: cada frecuencia cuenta el mes que le toca.
export function fixedExpensesForMonth(
  recurring: RecurringExpenseWithRelations[],
  monthKey: string,
): { total: number; items: FixedExpenseItem[] } {
  const monthStart = `${monthKey.slice(0, 7)}-01`
  const nextMonthStart = `${shiftMonth(monthKey, 1).slice(0, 7)}-01`
  const items: FixedExpenseItem[] = []
  let total = 0
  for (const r of recurring) {
    if (!r.is_active) continue
    if (r.next_due_date < monthStart || r.next_due_date >= nextMonthStart) continue
    const amount = Number(r.amount)
    total += amount
    items.push({ description: r.description, amount })
  }
  return { total, items }
}

// Sobrante mensual proyectado con rangos: ingresos − (fijos + variables).
export function monthlySurplusProjection(
  income: number,
  fixedExpenses: number,
  variable: ProjectionRange | null,
): ProjectionRange | null {
  if (!variable) return null
  return {
    median: income - fixedExpenses - variable.median,
    low: income - fixedExpenses - variable.high,
    high: income - fixedExpenses - variable.low,
  }
}

// Ahorro proyectado a N meses: saldo actual + sobrante mensual × N.
export function savingsInMonths(
  currentBalance: number,
  monthly: ProjectionRange,
  months: number,
): ProjectionRange {
  return {
    median: currentBalance + monthly.median * months,
    low: currentBalance + monthly.low * months,
    high: currentBalance + monthly.high * months,
  }
}

// Promedio de ingresos/gastos/sobrante de los surpluses históricos
// (últimos `months` meses completos; el mes actual se excluye).
export function averageFromSurpluses(
  surpluses: MonthlySurplus[],
  currentMonthKey: string,
  months = 6,
): { income: number; expenses: number; surplus: number } | null {
  const complete = surpluses.filter((s) => s.month < currentMonthKey)
  if (complete.length === 0) return null
  const window = complete.slice(-months)
  const sum = window.reduce(
    (acc, s) => ({
      income: acc.income + Number(s.income),
      expenses: acc.expenses + Number(s.expenses),
      surplus: acc.surplus + Number(s.surplus),
    }),
    { income: 0, expenses: 0, surplus: 0 },
  )
  const n = window.length
  return {
    income: sum.income / n,
    expenses: sum.expenses / n,
    surplus: sum.surplus / n,
  }
}
