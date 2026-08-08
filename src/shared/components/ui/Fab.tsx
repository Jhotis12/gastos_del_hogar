import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

// Botón flotante de acción principal (móvil): visible solo < lg, anclado
// sobre la navegación inferior con safe-area.
export default function Fab({ onClick, label, children }: {
  onClick: () => void
  label: string
  children?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-pine-700 text-white shadow-lg shadow-pine-900/30 transition-transform active:scale-95 lg:hidden"
    >
      {children ?? <Plus size={26} />}
    </button>
  )
}
