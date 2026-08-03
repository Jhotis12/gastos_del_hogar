import { WifiOff } from 'lucide-react'

// Sin conexión y sin datos guardados aún: en vez de quedarse cargando
// para siempre, se explica que la primera vez se necesita internet.
export default function OfflineGate() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={36} className="text-coral-600" />
      <p className="font-display text-base font-semibold text-ink">Sin conexión</p>
      <p className="max-w-xs text-sm text-ink/50">
        Necesitas internet la primera vez para cargar los datos de tu hogar.
        Cuando tengas señal, abre la app de nuevo y todo seguirá aquí.
      </p>
    </div>
  )
}
