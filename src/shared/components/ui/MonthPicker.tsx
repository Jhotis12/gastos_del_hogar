import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel, shiftMonth } from '@/shared/lib/dates'

interface MonthPickerProps {
  month: string
  onChange: (month: string) => void
}

export default function MonthPicker({ month, onChange }: MonthPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Sincroniza el input cuando el mes cambia por fuera (flechas, otra pestaña).
  // OJO: type="month" maneja "YYYY-MM" (sin día); el estado de la app es
  // "YYYY-MM-01". Comparar contra el estado completo hacía que el efecto
  // escribiera un valor inválido en el input cada vez (bug de "2026-08-01").
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const monthValue = month.slice(0, 7)
    if (input.value !== monthValue) input.value = monthValue
  }, [month])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-lg border border-slate-200 p-2.5 text-ink/50 hover:bg-cream"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <input
        ref={inputRef}
        id="month-picker-input"
        type="month"
        defaultValue={month.slice(0, 7)}
        onChange={(e) => {
          if (e.target.value) onChange(`${e.target.value}-01`)
        }}
        className="min-w-0 w-40 max-w-44 rounded-lg border border-slate-200 px-3 py-2 text-base font-medium text-ink/70 focus:border-pine-500 focus:outline-none"
      />
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-lg border border-slate-200 p-2.5 text-ink/50 hover:bg-cream"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={18} />
      </button>
      <span className="ml-1 hidden text-sm text-ink/50 sm:inline">
        {monthLabel(month)}
      </span>
    </div>
  )
}
