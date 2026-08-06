import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock'
import { useDragToClose } from '@/hooks/useDragToClose'
import { cn } from '@/lib/utils'

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
  const previousFocus = useRef<HTMLElement | null>(null)
  // onClose cambia de identidad en cada render del formulario padre (p. ej.
  // al escribir en un input): se guarda en un ref para que el efecto de foco
  // y scroll-lock corra solo cuando el modal se abre/cierra, no en cada
  // render (eso movía el foco al botón X al teclear).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Focus trap: Tab/Shift+Tab se mantienen dentro del modal
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    // Scroll-lock del fondo: contador compartido (soporta modales anidados
    // sin dejar el fondo bloqueado).
    lockBodyScroll()
    previousFocus.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      unlockBodyScroll()
      previousFocus.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={setPanelRef}
        onTouchStart={drag.onTouchStart}
        onTouchMove={drag.onTouchMove}
        onTouchEnd={drag.onTouchEnd}
        style={drag.dragStyle}
        className={cn(
          'animate-scale-in max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:pb-6',
          !drag.dragging && 'transition-transform duration-300 ease-out',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa de arrastre (móvil): invita a deslizar hacia abajo para cerrar */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/10 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
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
