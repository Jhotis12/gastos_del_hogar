import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

// Estado vacío unificado: icono en caja suave, mensaje y CTA opcional.
// Usar dentro de una .card (o con border-dashed para estados de página).
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  compact?: boolean
}

export default function EmptyState({ icon, title, hint, action, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-8' : 'py-14',
      )}
    >
      {icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-ink/25">
          {icon}
        </span>
      )}
      <p className="text-sm text-ink/40">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink/30">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
