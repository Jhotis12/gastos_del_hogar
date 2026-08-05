import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'reduce-animations'

// Ajuste "Reducir animaciones" (teléfonos de gama baja): añade la clase
// reduce-animations a <html>, que anula animaciones y transiciones CSS.
// Se aplica antes del primer render en main.tsx para evitar parpadeo.
export function getReduceAnimations(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useSettings() {
  const [reduceAnimations, setReduceAnimations] = useState(getReduceAnimations)

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-animations', reduceAnimations)
    try {
      localStorage.setItem(STORAGE_KEY, reduceAnimations ? '1' : '0')
    } catch {
      /* almacenamiento no disponible */
    }
  }, [reduceAnimations])

  const toggleReduceAnimations = useCallback(
    () => setReduceAnimations((v) => !v),
    [],
  )

  return { reduceAnimations, toggleReduceAnimations }
}
