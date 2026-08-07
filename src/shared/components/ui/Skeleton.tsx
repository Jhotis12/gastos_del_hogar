import { cn } from '@/shared/lib/utils'

// Bloque con shimmer: placeholder animado que indica que hay contenido
// cargando. tone="onDark" para superficies oscuras (hero del Dashboard).
export default function Skeleton({
  className,
  tone = 'default',
}: {
  className?: string
  tone?: 'default' | 'onDark'
}) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-gradient-to-r bg-[length:200%_100%]',
        tone === 'default'
          ? 'from-slate-200 via-slate-100 to-slate-200'
          : 'from-white/25 via-white/10 to-white/25',
        className,
      )}
    />
  )
}
