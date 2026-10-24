import { CalendarDays } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'
import { fieldBase } from '@/shared/components/ui/fieldClass'

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
        className={cn(fieldBase, 'py-3 pl-9 pr-4')}
      />
      <CalendarDays
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
      />
    </div>
  )
}
