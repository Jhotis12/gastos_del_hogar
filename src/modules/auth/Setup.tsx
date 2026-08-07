import { useState } from 'react'
import { Home, UserPlus } from 'lucide-react'
import AppLogo from '@/shared/components/ui/AppLogo'
import { useCreateHousehold, useJoinHousehold } from '@/hooks/useHousehold'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

export default function Setup() {
  const createHousehold = useCreateHousehold()
  const joinHousehold = useJoinHousehold()

  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'create') {
        await createHousehold.mutateAsync(name.trim())
      } else {
        await joinHousehold.mutateAsync(code)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error')
    }
  }

  const busy = createHousehold.isPending || joinHousehold.isPending

  return (
    <div className="force-light flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <AppLogo size={72} className="mb-4" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Bienvenido al hogar
          </h1>
          <p className="mt-1 max-w-xs text-sm text-ink/50">
            Crea un hogar nuevo o únete a uno existente con un código
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setMode('create')
              setError('')
            }}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
              mode === 'create'
                ? 'border-pine-600 bg-pine-50 text-pine-600'
                : 'border-slate-200 bg-surface text-ink/55 hover:bg-cream'
            }`}
          >
            <Home size={20} />
            Crear hogar
          </button>
          <button
            onClick={() => {
              setMode('join')
              setError('')
            }}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
              mode === 'join'
                ? 'border-pine-600 bg-pine-50 text-pine-600'
                : 'border-slate-200 bg-surface text-ink/55 hover:bg-cream'
            }`}
          >
            <UserPlus size={20} />
            Unirme a uno
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-sm">
          {mode === 'create' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">
                Nombre del hogar
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                autoComplete="organization"
                autoCapitalize="words"
                placeholder="Ej. Casa de la familia"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">
                Código de invitación
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`${inputClass} uppercase tracking-widest`}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABC123"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 min-h-12 w-full rounded-xl bg-pine-700 py-3 text-base font-semibold text-white shadow-md shadow-pine-900/20 transition-all hover:bg-pine-800 disabled:opacity-50"
          >
            {busy ? 'Procesando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
