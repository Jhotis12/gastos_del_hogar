import type { EffectiveSalary, Profile, Salary } from '@/lib/types'
import { daysInMonth } from '@/lib/dates'

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

// Salario efectivo por persona del mes: la fila del mes si existe; si no,
// el último salario registrado en un mes anterior (herencia), con su fecha
// de pago calculada según el día configurado. Sin historial → amount 0.
export function effectiveSalariesForMonth(
  salaries: Salary[],
  members: Pick<Profile, 'id' | 'payday'>[],
  month: string,
): EffectiveSalary[] {
  const monthRows = salaries.filter((s) => s.month === month)
  const pastRows = salaries
    .filter((s) => s.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))

  return members.map((m) => {
    const own = monthRows.find((s) => s.profile_id === m.id)
    if (own) {
      return {
        profile_id: m.id,
        amount: Number(own.amount),
        source_month: month,
        pay_date: own.pay_date,
      }
    }
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
}
