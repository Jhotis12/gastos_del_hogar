const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

// Convierte texto monetario al formato colombiano a número.
// "450.000" -> 450000 | "2.500.000,50" -> 2500000.5 | "450000" -> 450000
export function parseMoneyInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '')
  if (!s) return null
  if (!/^[\d.,]+$/.test(s)) return null
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/\./g, '')
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Formatea un número en miles con puntos: 450000 -> "450.000"
export function formatMoneyInput(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Formato compacto para gráficos: 1500000 -> "$1,5 M" (es-CO).
const compactFormatter = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCurrencyCompact(value: number): string {
  return '$' + compactFormatter.format(value)
}
