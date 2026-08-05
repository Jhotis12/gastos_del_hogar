// Paletas de color disponibles en Ajustes → Apariencia. Cada paleta reemplaza
// los acentos (primario + secundario) en modo claro y oscuro; los neutros y
// el color de peligro (coral) se mantienen. Las clases CSS viven en index.css
// (html[data-palette] / html.dark[data-palette]).
export interface Palette {
  id: string
  name: string
  primary: string
  secondary: string
}

export const PALETTES: Palette[] = [
  { id: 'pino', name: 'Pino', primary: '#206c55', secondary: '#b97a16' },
  { id: 'oceano', name: 'Océano', primary: '#1f5ea8', secondary: '#b97a16' },
  { id: 'violeta', name: 'Violeta', primary: '#6c37a6', secondary: '#c04484' },
  { id: 'rubi', name: 'Rubí', primary: '#9e2d2d', secondary: '#b97a16' },
  { id: 'esmeralda', name: 'Esmeralda', primary: '#247268', secondary: '#ad7316' },
]

export const DEFAULT_PALETTE = 'pino'

export function getPaletteId(): string {
  try {
    const saved = localStorage.getItem('palette')
    return PALETTES.some((p) => p.id === saved) ? (saved as string) : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}
