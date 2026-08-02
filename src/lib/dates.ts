export function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, (m ?? 1) - 1, 15, 12)
  return d.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })
}

const SHORT_MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${SHORT_MONTHS[(m ?? 1) - 1]} ${y}`
}

export function currentMonthKey(): string {
  return monthKey(new Date())
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, (m ?? 1) - 1 + delta, 15, 12)
  return monthKey(d)
}

export function formatDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(
    'es-MX',
    { day: 'numeric', month: 'short' },
  )
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}
