import { useRef, useState } from 'react'

const CLOSE_THRESHOLD = 72
const MAX_DRAG = 120

// Arrastre hacia abajo para cerrar (bottom sheets en móvil).
// - Solo activo en pantallas <640px (en desktop los modales están centrados)
// - Solo cuando el panel está arriba del todo (scrollTop 0): si hay contenido
//   scrolleado, el gesto scrollea en vez de cerrar
// - Al soltar: cierra si pasó el umbral (72px), si no vuelve a su lugar
//   con una transición suave
export function useDragToClose(onClose: () => void) {
  const [dy, setDy] = useState(0)
  const dragging = useRef(false)
  const startY = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (window.matchMedia('(min-width: 640px)').matches) return
    const panel = panelRef.current
    if (!panel || panel.scrollTop > 0) return
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
    setDy((current) => {
      if (current >= CLOSE_THRESHOLD) onClose()
      return 0
    })
  }

  return {
    panelRef,
    // Sin transición mientras se arrastra (sigue al dedo); con transición
    // al soltar para el rebote de vuelta
    dragStyle: dy > 0
      ? ({ transform: `translateY(${dy}px)`, transition: 'none' } as const)
      : undefined,
    dragging: dy > 0,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
