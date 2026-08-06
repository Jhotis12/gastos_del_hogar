import { useRef, useState } from 'react'

const CLOSE_THRESHOLD = 56
const MAX_DRAG = 120
const EXIT_MS = 260

// Cierre por arrastre de los bottom sheets en móvil, SOLO desde el asa
// superior (la "rallita"): el usuario desliza el asa hacia abajo y el panel
// la sigue; al soltar, si pasó el umbral cierra con animación de salida
// (se desliza hacia abajo y desaparece) y si no, rebota a su lugar.
//
// El asa lleva touch-action: none (touch-none) para que el navegador no
// scrolle el panel mientras se arrastra. Como el asa vive DENTRO del
// contenedor scrolleable, al hacer scroll el asa se va de la pantalla:
// no hay cierres accidentales con contenido scrolleado.
export function useDragToClose(onClose: () => void) {
  const [dy, setDy] = useState(0)
  const [closing, setClosing] = useState(false)
  const [touching, setTouching] = useState(false)
  const dragging = useRef(false)
  const startY = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Cierra con animación: desliza hacia abajo y, al terminar, llama al
  // onClose real. Si el padre no desmonta (p. ej. formulario con cambios
  // sin guardar que abre otro diálogo), el panel vuelve a su lugar.
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, EXIT_MS)
  }

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (window.matchMedia('(min-width: 640px)').matches) return
    setTouching(true)
    dragging.current = true
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) return
    setDy(Math.min(delta, MAX_DRAG))
  }

  const onTouchEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    setTouching(false)
    setDy((current) => {
      if (current >= CLOSE_THRESHOLD) requestClose()
      return 0
    })
  }

  // Prioridad de estilos: saliendo (slide-down) > arrastrando (sigue al dedo)
  let style: React.CSSProperties | undefined
  if (closing) {
    style = {
      transform: 'translateY(100%)',
      transition: `transform ${EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    }
  } else if (dy > 0) {
    style = { transform: `translateY(${dy}px)`, transition: 'none' }
  }

  return {
    panelRef,
    style,
    closing,
    dragging: dy > 0,
    touching,
    // Props para el asa superior (la "rallita")
    handleProps: { onTouchStart, onTouchMove, onTouchEnd },
    requestClose,
  }
}
