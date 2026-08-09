import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

// Atrapa errores de renderizado en CUALQUIER parte del árbol y muestra una
// pantalla "Ups…" en lugar de dejar la app en blanco. Se reinicia con
// "Volver al inicio" (re-monta la app) o "Recargar".
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado',
    }
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-100 text-coral-600">
            <AlertTriangle size={26} />
          </span>
          <h1 className="font-display text-lg font-bold tracking-tight text-ink">
            Ups… algo salió mal
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            No pudimos mostrar este contenido. Intenta recargar la página o
            vuelve al inicio.
          </p>
          <p className="mt-3 truncate rounded-lg bg-cream px-3 py-2 text-xs text-ink/40">
            {this.state.message}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white hover:bg-pine-800"
            >
              <RefreshCcw size={16} />
              Recargar
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-ink/70 hover:bg-cream"
            >
              <Home size={16} />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
