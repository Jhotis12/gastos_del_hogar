import { cn } from '@/shared/lib/utils'

interface CategoryBadgeProps {
  name: string
  color: string
  className?: string
}

export default function CategoryBadge({ name, color, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        // El texto usa un token del tema (contraste AA sobre el tinte); el
        // color de la categoría queda en el punto y en el fondo.
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink/75',
        className,
      )}
      style={{ backgroundColor: `${color}1a` }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  )
}
