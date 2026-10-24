import { useEffect, useRef, type RefObject } from 'react'
import { lockBodyScroll, unlockBodyScroll } from '@/shared/lib/scrollLock'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Comportamiento de diálogo para los overlays con role="dialog": Escape para
// cerrar, Tab atrapado dentro del panel, foco inicial y restauración del foco
// al cerrar. Lo usan el Modal compartido y los sheets propios (action sheet de
// Gastos, sheet "Más"), para que todos se comporten igual.
//
// El callback de cierre se guarda en un ref: los padres lo recrean en cada
// render (p. ej. al teclear) y el efecto no debe reiniciarse en cada tecla.
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>,
): void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null

    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items || items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    lockBodyScroll()
    window.addEventListener('keydown', handler)
    ;(initialFocus?.current ?? focusables()?.[0] ?? panelRef.current)?.focus()

    return () => {
      window.removeEventListener('keydown', handler)
      unlockBodyScroll()
      previousFocus?.focus()
    }
  }, [open, panelRef, initialFocus])
}
