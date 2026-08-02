import AppLogo from '@/components/ui/AppLogo'

// Carga de página completa: logo con pulso suave y texto breve, sin shimmer.
// La animación de skeleton queda reservada para contenido puntual donde
// aporta contexto (p. ej. la imagen del recibo cargando).
export default function PageSkeleton() {
  return (
    <div
      className="flex min-h-[55vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Cargando contenido"
    >
      <div className="animate-pulse-soft">
        <AppLogo size={56} className="drop-shadow-sm" />
      </div>
      <p className="text-sm text-ink/40">Cargando…</p>
    </div>
  )
}
