import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'register'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    if (mode === 'register') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (signUpError) {
        setError(signUpError.message)
        setBusy(false)
        return
      }
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setBusy(false)
    if (signInError) {
      setError('Correo o contraseña incorrectos')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine-700 text-white">
            <Wallet size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Gastos del Hogar</h1>
          <p className="mt-1 text-sm text-ink/50">
            Gestiona el presupuesto común de tu hogar
          </p>
        </div>

        <div className="card p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
            <button
              onClick={() => setMode('login')}
              className={`rounded-md py-2 text-sm font-medium ${
                mode === 'login'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink/50 hover:text-ink/70'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode('register')}
              className={`rounded-md py-2 text-sm font-medium ${
                mode === 'register'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink/50 hover:text-ink/70'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none"
                  placeholder="Tu nombre"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg hover:bg-coral-100/70 px-3 py-2 text-sm text-coral-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-pine-700 py-2.5 text-sm font-semibold text-white hover:bg-pine-800 disabled:opacity-50"
            >
              {busy
                ? 'Procesando…'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
