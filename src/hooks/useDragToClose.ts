import { useRef, useState } from 'react'

const CLOSE_THRESHOLD = 56
const MAX_DRAG = 140
const EXIT_MS = 260
// Velocidad mínima (px/ms) para cerrar con un movimiento rápido (flick):
// aunque no se llegue al umbral de distancia, un gesto veloz esconde el modal.
const FLICK_VELOCITY = 0.6

// Cierre por arrastre de los bottom sheets en móvil, SOLO desde el asa
// superior (la "rallita").
//
// El panel ACOMPAÑA AL DEDO en tiempo real: el transform se escribe directo
// en el DOM en cada touchmove (React puede agrupar varios moves y causar
// lag) y el estado solo se usa para el render.
//
// Al soltar:
// - Cierra si pasó el umbral de distancia O si el gesto fue rápido (velocidad)
// - Si no, rebota a su lugar con transición suave
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
  const dyRef = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const velocity = useRef(0)
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
    lastY.current = e.touches[0].clientY
    lastTime.current = performance.now()
    velocity.current = 0
  }

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const y = e.touches[0].clientY
    const now = performance.now()
    const dt = now - lastTime.current
    if (dt > 0) velocity.current = (y - lastY.current) / dt
    lastY.current = y
    lastTime.current = now

    const delta = y - startY.current
    if (delta <= 0) {
      // Movimiento hacia arriba: no arrastra ni cierra por velocidad
      velocity.current = 0
      return
    }
    const next = Math.min(delta, MAX_DRAG)
    dyRef.current = next
    // El panel acompaña al dedo sin lag: transform directo en el DOM
    const panel = panelRef.current
    if (panel) {
      panel.style.transform = `translateY(${next}px)`
      panel.style.transition = 'none'
    }
    setDy(next)
  }

  const onTouchEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    setTouching(false)
    const shouldClose =
      dyRef.current >= CLOSE_THRESHOLD || velocity.current > FLICK_VELOCITY
    dyRef.current = 0
    setDy(0)
    if (shouldClose) {
      // Desde la posición actual (escrita en el DOM) se desliza hasta abajo
      requestClose()
      return
    }
    // Rebote: React limpia el transform inline y la clase transition
    // (duration-300) anima la vuelta a su lugar
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
