import { useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDragToClose } from '@/shared/hooks/useDragToClose'
import { useDialogA11y } from '@/shared/hooks/useDialogA11y'
import { cn } from '@/shared/lib/utils'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useDragToClose(onClose)
  const setPanelRef = (el: HTMLDivElement | null) => {
    panelRef.current = el
    drag.panelRef.current = el
  }
  // Escape, Tab atrapado, scroll-lock y foco inicial/restaurado.
  useDialogA11y(open, drag.requestClose, panelRef, closeRef)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={drag.requestClose}
    >
      <div
        ref={setPanelRef}
        style={drag.style}
        className={cn(
          // Móvil: entra deslizándose desde abajo; desktop: escala centrada
          'animate-sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:animate-scale-in sm:rounded-2xl sm:pb-6',
          !drag.dragging && !drag.closing && 'transition-transform duration-300 ease-out',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa de arrastre (móvil): al tocarla se ilumina para indicar que
            se puede deslizar hacia abajo y cerrar */}
        <div
          {...drag.handleProps}
          className="mb-1 flex shrink-0 touch-none justify-center py-2 sm:hidden"
        >
          <span
            className={cn(
              'h-1 w-10 rounded-full transition-colors duration-200',
              drag.touching ? 'bg-pine-500' : drag.dragging ? 'bg-pine-600' : 'bg-ink/10',
            )}
          />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            ref={closeRef}
            onClick={drag.requestClose}
            className="rounded-lg p-2.5 text-ink/40 hover:bg-slate-100 hover:text-ink/55"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
