import { useCallback, useEffect, useState } from 'react'
import { getPaletteId, DEFAULT_PALETTE } from '@/shared/lib/palettes'

const REDUCE_KEY = 'reduce-animations'
const PALETTE_KEY = 'palette'

// Ajustes de apariencia: "Reducir animaciones" (clase reduce-animations en
// <html> que anula animaciones/transiciones CSS) y "Paleta de colores"
// (atributo data-palette en <html> que reemplaza los acentos). Ambos se
// aplican antes del primer render en main.tsx para evitar parpadeo.
export function getReduceAnimations(): boolean {
  try {
    return localStorage.getItem(REDUCE_KEY) === '1'
  } catch {
    return false
  }
}

export function useSettings() {
  const [reduceAnimations, setReduceAnimations] = useState(getReduceAnimations)
  const [palette, setPalette] = useState<string>(getPaletteId)

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-animations', reduceAnimations)
    try {
      localStorage.setItem(REDUCE_KEY, reduceAnimations ? '1' : '0')
    } catch {
      /* almacenamiento no disponible */
    }
  }, [reduceAnimations])

  useEffect(() => {
    document.documentElement.dataset.palette = palette || DEFAULT_PALETTE
    try {
      localStorage.setItem(PALETTE_KEY, palette || DEFAULT_PALETTE)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [palette])

  const toggleReduceAnimations = useCallback(
    () => setReduceAnimations((v) => !v),
    [],
  )
  const applyPalette = useCallback((id: string) => setPalette(id), [])

  return { reduceAnimations, toggleReduceAnimations, palette, applyPalette }
}
