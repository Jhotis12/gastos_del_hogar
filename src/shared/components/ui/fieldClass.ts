// Estilo base de un campo de texto del proyecto: una sola definición del
// borde, radio, 16px (sin zoom en iOS) y anillo de foco. El padding y el color
// de texto los agrega cada campo, porque los que llevan icono usan padding
// asimétrico (MoneyInput, DateInput, buscadores).
export const fieldBase =
  'w-full rounded-xl border border-slate-200 bg-surface text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

// Campo de texto estándar (sin icono), el que usan los formularios.
export const fieldClass = `${fieldBase} px-4 py-3`
