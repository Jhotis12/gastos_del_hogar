import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { formatCurrency } from '@/lib/money'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number
  icon: ReactNode
  tone?: 'default' | 'positive' | 'negative'
  delay?: number
}

export default function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  delay = 0,
}: StatCardProps) {
  const animated = useCountUp(value)

  return (
    <div
      className="card card-hover animate-fade-up p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink/60">{label}</p>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            tone === 'positive' && 'bg-pine-50 text-pine-600',
            tone === 'negative' && 'bg-coral-100 text-coral-600',
            tone === 'default' && 'bg-gold-100 text-gold-600',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-bold tracking-tight',
          tone === 'positive' && 'text-pine-600',
          tone === 'negative' && 'text-coral-600',
          tone === 'default' && 'text-ink',
        )}
      >
        {formatCurrency(animated)}
      </p>
    </div>
  )
}
