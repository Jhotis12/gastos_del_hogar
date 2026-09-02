import type { EffectiveSalary, Profile, Salary } from '@/shared/lib/types'
import { daysInMonth, todayISO } from '@/shared/lib/dates'

// Fecha de pago de una persona para un mes dado: su día configurado
// (payday, 1-31) recortado al último día del mes. Default: día 1.
export function payDateForMonth(
  payday: number | null | undefined,
  month: string,
): string {
  const [y, m] = month.slice(0, 7).split('-').map(Number)
  const lastDay = daysInMonth(y ?? 1, (m ?? 1) - 1)
  const day = Math.min(Math.max(payday ?? 1, 1), lastDay)
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Salarios efectivos del mes: la fila registrada para el mes (month = M) —
// su pay_date puede caer en otro mes (nómina adelantada/atrasada); la
// atribución de ingreso POR FECHA la hacen los RPCs (cash basis). Para
// personas sin fila en el mes: se hereda el último salario registrado en
// un mes anterior, con su fecha de pago calculada según el día configurado.
// Sin historial → 0. La herencia NO pisa a quien ya tiene fila del mes:
// eso evita contar dos veces una nómina con pay_date en otro mes.
export function effectiveSalariesForMonth(
  salaries: Salary[],
  members: Pick<Profile, 'id' | 'payday'>[],
  month: string,
): EffectiveSalary[] {
  const rowsForMonth = salaries.filter((s) => s.month === month)
  const rowsIds = new Set(rowsForMonth.map((s) => s.profile_id))
  const pastRows = salaries
    .filter((s) => s.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))

  const inherited = members
    .filter((m) => !rowsIds.has(m.id))
    .map((m) => {
      const prev = pastRows.find((s) => s.profile_id === m.id)
      if (!prev) {
        return {
          profile_id: m.id,
          amount: 0,
          source_month: null,
          pay_date: payDateForMonth(m.payday, month),
        }
      }
      return {
        profile_id: m.id,
        amount: Number(prev.amount),
        source_month: prev.month,
        pay_date: payDateForMonth(m.payday, month),
      }
    })

  return [
    ...rowsForMonth.map((s) => ({
      profile_id: s.profile_id,
      amount: Number(s.amount),
      source_month: s.month,
      pay_date: s.pay_date,
    })),
    ...inherited,
  ]
}

// Salarios YA recibidos del mes (cash basis): el salario — registrado o
// heredado — solo cuenta como ingreso cuando su pay_date llegó. La fecha
// límite es min(hoy, fin de mes) para no contar gastos/ingresos del futuro
// en meses navegados. Coincide con get_monthly_surpluses (servidor).
export function receivedSalariesForMonth(
  salaries: EffectiveSalary[],
  month: string,
): EffectiveSalary[] {
  const [y, m] = month.slice(0, 7).split('-').map(Number)
  const lastDay = daysInMonth(y ?? 1, (m ?? 1) - 1)
  const endOfMonth = `${month.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
  const pDate = todayISO() < endOfMonth ? todayISO() : endOfMonth
  return salaries.filter((s) => s.pay_date <= pDate)
}
