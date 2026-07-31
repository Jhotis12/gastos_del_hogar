import { useState } from 'react'
import { Home, UserPlus } from 'lucide-react'
import { useCreateHousehold, useJoinHousehold } from '@/hooks/useHousehold'

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
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Bienvenido al hogar
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            Crea un hogar nuevo o únete a uno existente con un código
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('create')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
              mode === 'create'
                ? 'border-pine-700 bg-pine-50 text-pine-700'
                : 'border-slate-200 bg-white text-ink/55 hover:bg-cream'
            }`}
          >
            <Home size={18} />
            Crear hogar
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
              mode === 'join'
                ? 'border-pine-700 bg-pine-50 text-pine-700'
                : 'border-slate-200 bg-white text-ink/55 hover:bg-cream'
            }`}
          >
            <UserPlus size={18} />
            Unirme a uno
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card p-6 shadow-sm"
        >
          {mode === 'create' ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Nombre del hogar
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none"
                placeholder="Ej. Casa de la familia"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Código de invitación
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase tracking-widest focus:border-pine-500 focus:outline-none"
                placeholder="ABC123"
              />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg hover:bg-coral-100/70 px-3 py-2 text-sm text-coral-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-pine-700 py-2.5 text-sm font-semibold text-white hover:bg-pine-800 disabled:opacity-50"
          >
            {busy ? 'Procesando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
