import { daysInMonth } from './dates.ts'

export type DateRange = { start: string; end: string }

export type SalaryDate = { pay_date: string }

export type PaydayInput = {
  payday?: number | null
  salaries?: SalaryDate[]
  asOf: string
}

function isoDate(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseISO(iso: string): { year: number; month0: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return { year: year ?? 1970, month0: (month ?? 1) - 1, day: day ?? 1 }
}

// Día de pago recortado al último día del mes (31 → 28/29/30).
export function clampPayday(
  payday: number | null | undefined,
  month: string,
): number {
  const { year, month0 } = parseISO(month.length === 7 ? `${month}-01` : month)
  const lastDay = daysInMonth(year, month0)
  return Math.min(Math.max(Math.trunc(payday ?? 1), 1), lastDay)
}

function paydayDate(
  payday: number | null | undefined,
  year: number,
  month0: number,
): string {
  return isoDate(year, month0, clampPayday(payday, isoDate(year, month0, 1)))
}

// Último pago real <= asOf; si no hay nóminas, el payday configurado del mes
// o del anterior cuando el día aún no llega. Fechas locales, nunca UTC.
export function lastPaydayDate({
  payday,
  salaries = [],
  asOf,
}: PaydayInput): string {
  const end = asOf.slice(0, 10)
  const paid = salaries
    .map((salary) => salary.pay_date.slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= end)
    .sort()

  const latest = paid.at(-1)
  if (latest) return latest

  const { year, month0 } = parseISO(end)
  const current = paydayDate(payday, year, month0)
  if (current <= end) return current

  const previous = new Date(year, month0 - 1, 1, 12)
  return paydayDate(payday, previous.getFullYear(), previous.getMonth())
}

// Mes calendario en curso: primer día hasta asOf, ambos inclusive.
export function monthToDateWindow(asOf: string): DateRange {
  const end = asOf.slice(0, 10)
  const { year, month0 } = parseISO(end)
  return { start: isoDate(year, month0, 1), end }
}

// Desde el último pago (real o configurado) hasta asOf, ambos inclusive.
export function sincePaydayWindow(input: PaydayInput): DateRange {
  return { start: lastPaydayDate(input), end: input.asOf.slice(0, 10) }
}

function dayMonthLabel(iso: string): { day: number; month: string; year: number } {
  const { year, month0, day } = parseISO(iso)
  const month = new Date(year, month0, day, 12).toLocaleDateString('es-CO', {
    month: 'long',
  })
  return { day, month, year }
}

// Etiqueta legible: "1–24 de octubre" o "30 de septiembre – 2 de octubre".
export function rangeLabel({ start, end }: DateRange): string {
  const a = dayMonthLabel(start)
  const b = dayMonthLabel(end)

  if (a.year === b.year && a.month === b.month) {
    return a.day === b.day
      ? `${a.day} de ${a.month}`
      : `${a.day}–${b.day} de ${a.month}`
  }

  if (a.year === b.year) {
    return `${a.day} de ${a.month} – ${b.day} de ${b.month}`
  }

  return `${a.day} de ${a.month} de ${a.year} – ${b.day} de ${b.month} de ${b.year}`
}
