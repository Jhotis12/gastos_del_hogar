import type { EffectiveSalary, Profile, Salary } from '@/shared/lib/types'
import { daysInMonth } from '@/shared/lib/dates'

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

// Salarios efectivos del mes: toda fila cuyo pay_date (fecha REAL de
// llegada del dinero) cae dentro del mes — puede haber varias por persona
// si un pago atrasado de otro mes llegó aquí. Para personas sin fila en el
// mes: se hereda el último salario registrado en un mes anterior, con su
// fecha de pago calculada según el día configurado. Sin historial → 0.
// pay_date es la fuente de verdad: coincide con get_monthly_surpluses
// (que agrupa por pay_date) y con el saldo disponible (cash basis).
export function effectiveSalariesForMonth(
  salaries: Salary[],
  members: Pick<Profile, 'id' | 'payday'>[],
  month: string,
): EffectiveSalary[] {
  const [y, m] = month.slice(0, 7).split('-').map(Number)
  const lastDay = daysInMonth(y ?? 1, (m ?? 1) - 1)
  const start = `${month.slice(0, 7)}-01`
  const end = `${month.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`

  const arriving = salaries
    .filter((s) => s.pay_date >= start && s.pay_date <= end)
    .sort((a, b) => a.pay_date.localeCompare(b.pay_date))

  const arrivingIds = new Set(arriving.map((s) => s.profile_id))
  const pastRows = salaries
    .filter((s) => s.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))

  const inherited = members
    .filter((m) => !arrivingIds.has(m.id))
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
    ...arriving.map((s) => ({
      profile_id: s.profile_id,
      amount: Number(s.amount),
      source_month: s.month,
      pay_date: s.pay_date,
    })),
    ...inherited,
  ]
}
