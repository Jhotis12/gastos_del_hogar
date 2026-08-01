import { CalendarDays } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

// Input de fecha con estilo consistente e icono de calendario
export default function DateInput({ className, ...props }: DateInputProps) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="date"
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-surface py-3 pl-9 pr-4 text-base text-ink focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20"
      />
      <CalendarDays
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
      />
    </div>
  )
}
