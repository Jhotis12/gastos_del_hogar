import { cn } from '@/lib/utils'

// Switch reutilizable (tema, animaciones, servicios…). Tokens del sistema,
// así que respeta el modo oscuro automáticamente.
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
  disabled?: boolean
}

export default function Toggle({ checked, onChange, 'aria-label': ariaLabel, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
        checked ? 'justify-end bg-pine-700' : 'justify-start bg-slate-300',
      )}
    >
      <span className="h-6 w-6 rounded-full bg-surface shadow" />
    </button>
  )
}
