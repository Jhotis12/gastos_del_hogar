import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

// Select nativo con indicador de desplegable visible en todas las plataformas
export default function SelectInput({ className, children, ...props }: SelectInputProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        {...props}
        className="w-full appearance-none rounded-xl border border-slate-200 bg-surface px-4 py-3 pr-10 text-base text-ink focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20"
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40"
      />
    </div>
  )
}
