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
  { id: 'oceano', name: 'Océano', primary: '#0284c7', secondary: '#0ea5e9' },
  { id: 'marino', name: 'Marino', primary: '#2f4f99', secondary: '#a16207' },
  { id: 'violeta', name: 'Violeta', primary: '#6c37a6', secondary: '#c04484' },
  { id: 'rubi', name: 'Rubí', primary: '#dc2626', secondary: '#ca8a04' },
  { id: 'esmeralda', name: 'Esmeralda', primary: '#0d9488', secondary: '#d97706' },
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
