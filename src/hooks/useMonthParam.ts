import { useSearchParams } from 'react-router-dom'
import { currentMonthKey } from '@/lib/dates'

// Mes sincronizado con la URL (?mes=2026-08-01): la skill de diseño pide que
// la URL refleje el estado de la vista (deep linking) — el mes se puede
// compartir, marcar y sobrevive a la recarga. El patrón "YYYY-MM-01" es el
// formato interno de la app; fuera de él se usa el mes actual.
const MONTH_RE = /^\d{4}-\d{2}-01$/

export function useMonthParam(): [string, (month: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const raw = searchParams.get('mes') ?? ''
  const month = MONTH_RE.test(raw) ? raw : currentMonthKey()

  const setMonth = (m: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('mes', m)
    setSearchParams(next, { replace: true })
  }

  return [month, setMonth]
}
