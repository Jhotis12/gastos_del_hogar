import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  compact?: boolean
}

export default function ThemeToggle({ className, compact }: ThemeToggleProps) {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'flex items-center gap-3 rounded-xl text-ink/55 transition-colors hover:bg-cream hover:text-ink',
        compact ? 'p-2' : 'w-full px-3 py-2 text-sm font-medium',
        className,
      )}
    >
      {theme === 'dark' ? (
        <Sun size={18} className={compact ? '' : 'text-gold-600'} />
      ) : (
        <Moon size={18} className={compact ? '' : 'text-pine-600'} />
      )}
      {!compact && (theme === 'dark' ? 'Modo claro' : 'Modo oscuro')}
    </button>
  )
}
