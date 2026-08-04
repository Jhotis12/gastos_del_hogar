import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel, shiftMonth } from '@/lib/dates'

interface MonthPickerProps {
  month: string
  onChange: (month: string) => void
}

export default function MonthPicker({ month, onChange }: MonthPickerProps) {
  useEffect(() => {
    const input = document.getElementById('month-picker-input') as HTMLInputElement | null
    if (input && input.value !== month) input.value = month
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
        id="month-picker-input"
        type="month"
        defaultValue={month.slice(0, 7)}
        onChange={(e) => {
          if (e.target.value) onChange(`${e.target.value}-01`)
        }}
        className="rounded-lg border border-slate-200 px-3 py-2 text-base font-medium text-ink/70 focus:border-pine-500 focus:outline-none"
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
