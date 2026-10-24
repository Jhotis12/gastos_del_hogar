import {
  monthToDateWindow,
  sincePaydayWindow,
  type DateRange,
  type SalaryDate,
} from '../../../shared/lib/periods.ts'

export type FinanceWindowInput = {
  payday?: number | null
  salaries?: SalaryDate[]
  asOf: string
}

export type FinanceWindow = {
  month: DateRange
  cycle: DateRange
  union: DateRange
}

// La UI necesita filas de ambas ventanas; se carga una sola unión.
export function financeWindow({
  payday,
  salaries = [],
  asOf,
}: FinanceWindowInput): FinanceWindow {
  const end = asOf.slice(0, 10)
  const month = monthToDateWindow(end)
  const cycle = sincePaydayWindow({ payday, salaries, asOf: end })

  return {
    month,
    cycle,
    union: {
      start: month.start < cycle.start ? month.start : cycle.start,
      end,
    },
  }
}
