import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck, Users, ReceiptText } from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'register'

const FEATURES = [
  { icon: Users, text: 'Salarios por persona en un fondo común' },
  { icon: ReceiptText, text: 'Escanea tus facturas y crea gastos automáticamente' },
  { icon: ShieldCheck, text: 'Presupuestos, servicios y metas de ahorro' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/20'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      setMode('login')
      setError('Revisa tu correo para confirmar tu cuenta y luego inicia sesión.')
      setBusy(false)
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
    <div className="force-light flex min-h-screen bg-cream lg:bg-surface">
      {/* Panel de marca (desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-pine-700 via-pine-800 to-pine-950 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-pine-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <AppLogo size={44} />
          <p className="font-display text-lg font-bold">Gastos del Hogar</p>
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            El presupuesto de tu hogar,
            <span className="text-gold-300"> en un solo lugar.</span>
          </h1>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-4 text-pine-100">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface/10">
                  <f.icon size={18} />
                </span>
                <span className="text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-pine-300">
          Hecho para hogares colombianos 🇨🇴
        </p>
      </div>

      {/* Formulario */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center lg:items-start">
            <AppLogo size={64} className="mb-4 lg:hidden" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              {mode === 'login' ? '¡Hola de nuevo!' : 'Crea tu cuenta'}
            </h2>
            <p className="mt-1 text-sm text-ink/50">
              {mode === 'login'
                ? 'Ingresa para gestionar las finanzas de tu hogar'
                : 'Empieza a organizar los gastos de tu hogar'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1">
            <button
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`min-h-11 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink/50 hover:text-ink/70'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => {
                setMode('register')
                setError('')
              }}
              className={`min-h-11 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink/50 hover:text-ink/70'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Nombre</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Tu nombre"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                enterKeyHint="next" placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  enterKeyHint="done" placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/40 hover:text-ink/70"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                className={`rounded-xl px-4 py-3 text-sm ${
                  error.startsWith('Revisa tu correo')
                    ? 'bg-pine-50 text-pine-700'
                    : 'bg-coral-100/60 text-coral-700'
                }`}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-xl bg-pine-700 py-3 text-[15px] font-semibold text-white shadow-md shadow-pine-900/20 transition-all hover:bg-pine-800 disabled:opacity-50"
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
