// Motor financiero de la lista de deseos (funciones puras, sin I/O).
//
// Amortización francesa (la fórmula bancaria estándar):
//   cuota = P · i · (1+i)^n / ((1+i)^n − 1)   (con i = tasa mensual)
//   sin interés: cuota = P / n
//
// Corte de tarjeta (regla colombiana): una compra hecha DESPUÉS del día
// de corte entra al siguiente ciclo → la primera cuota vence en el corte
// del mes siguiente (~45 días). Si se compra ANTES o el mismo día del
// corte, la primera cuota vence en el corte del mes actual.
import { daysInMonth } from '@/shared/lib/dates'

export interface InstallmentPlan {
  installments: number
  rateMonthly: number // porcentaje mensual (0 = sin interés)
  cutoffDay: number | null // día de corte de la tarjeta (1-31)
  purchaseDate: string | null // YYYY-MM-DD
  initialPayment?: number // abono inicial de contado (0 si no hay)
}

export interface PlanResult {
  installment: number // cuota mensual (o precio si contado)
  totalPaid: number // cuota × n (o precio)
  totalInterest: number // totalPaid − precio
  firstPaymentDate: string | null // YYYY-MM-DD de la primera cuota
  monthlyDue: number // cuotas que vencen en el mes actual (0 o 1)
  monthlyDueDate: string | null
}

// Fecha de corte del mes (clamping al último día del mes).
export function cutoffDateOf(monthKey: string, cutoffDay: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const last = daysInMonth(y, m - 1)
  const day = Math.min(Math.max(cutoffDay, 1), last)
  return `${monthKey.slice(0, 7)}-${String(day).padStart(2, '0')}`
}

// Primera cuota según la fecha de compra y el día de corte.
export function firstPaymentDate(
  purchaseDate: string,
  cutoffDay: number,
): string {
  const purchase = purchaseDate ?? new Date().toISOString().slice(0, 10)
  const [y, m, d] = purchase.split('-').map(Number)
  const monthKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const sameMonth = cutoffDateOf(monthKey, cutoffDay)
  const nextMonth = cutoffDateOf(shiftMonthKey(monthKey), cutoffDay)
  // Si compró después del corte, entra al ciclo siguiente.
  return d <= cutoffDay ? sameMonth : nextMonth
}

function shiftMonthKey(key: string, delta = 1): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1, 12)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Calcula el plan de cuotas (contado si n === null).
export function calculatePlan(
  price: number,
  plan: InstallmentPlan,
  currentMonthKey: string,
): PlanResult {
  if (!plan.installments || plan.installments <= 0) {
    return {
      installment: price,
      totalPaid: price,
      totalInterest: 0,
      firstPaymentDate: null,
      monthlyDue: 0,
      monthlyDueDate: null,
    }
  }
  const n = plan.installments
  const i = (plan.rateMonthly ?? 0) / 100
  const initial = plan.initialPayment ?? 0
  const financed = Math.max(0, price - initial)
  const installment =
    i === 0
      ? financed / n
      : (financed * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
  const totalPaid = initial + installment * n
  const totalInterest = totalPaid - price

  let firstPaymentDateValue: string | null = null
  let monthlyDue = 0
  let monthlyDueDate: string | null = null
  if (plan.cutoffDay && plan.purchaseDate) {
    firstPaymentDateValue = firstPaymentDate(plan.purchaseDate, plan.cutoffDay)
    // Solo hay cuota en los meses que cubre el plan: desde el mes de la
    // primera cuota hasta n-1 meses después. Así una compra antigua no
    // sigue sumando al compromiso mensual para siempre.
    const firstMonth = `${firstPaymentDateValue.slice(0, 7)}-01`
    const lastMonth = shiftMonthKey(firstMonth, n - 1)
    const current = `${currentMonthKey.slice(0, 7)}-01`
    if (current >= firstMonth && current <= lastMonth) {
      monthlyDue = 1
      // La cuota que vence este mes se cobra en el corte de este mes.
      monthlyDueDate = cutoffDateOf(currentMonthKey, plan.cutoffDay)
    }
  }

  return {
    installment: round(installment),
    totalPaid: round(totalPaid),
    totalInterest: round(totalInterest),
    firstPaymentDate: firstPaymentDateValue,
    monthlyDue,
    monthlyDueDate,
  }
}

// Meses necesarios ahorrando `monthly` para comprar de contado
// (descontando el abono inicial si ya se tiene previsto).
export function monthsToAfford(price: number, monthly: number, initial = 0): number {
  const needed = Math.max(0, price - initial)
  if (needed <= 0) return 0
  if (monthly <= 0) return Infinity
  return Math.ceil(needed / monthly)
}

// Saldo restante tras la compra: abono inicial + cuota del primer mes
// (cuotas) o el precio completo (contado).
export function balanceAfterPurchase(
  balance: number,
  plan: PlanResult,
  method: 'contado' | 'cuotas',
  initialPayment = 0,
): number {
  if (method === 'contado') return balance - plan.totalPaid
  const initial = Math.min(initialPayment, plan.totalPaid)
  return balance - initial - plan.installment
}

// Cuánto se ahorra esperando y comprando de contado vs el plan en cuotas.
export function savingsByWaiting(price: number, planResult: PlanResult): number {
  return Math.max(0, planResult.totalPaid - price)
}

function round(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}
