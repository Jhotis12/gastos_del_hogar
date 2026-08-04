import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
  ReceiptText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import AppLogo from '@/components/ui/AppLogo'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

const FEATURES = [
  { icon: Users, text: 'Salarios por persona en un fondo común' },
  { icon: ReceiptText, text: 'Escanea tus facturas y crea gastos automáticamente' },
  { icon: ShieldCheck, text: 'Presupuestos, servicios y metas de ahorro' },
]

// Nombre: solo letras (con acentos y ñ) separadas por espacios, mínimo 2 letras
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputBase =
  'w-full rounded-xl border bg-surface py-3 pl-11 pr-4 text-base text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-colors'
const inputOk = 'border-slate-200 focus:border-pine-500 focus:ring-pine-500/20'
const inputBad = 'border-coral-400 focus:border-coral-500 focus:ring-coral-500/20'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-coral-600"
    >
      <AlertCircle size={13} className="shrink-0" />
      {message}
    </p>
  )
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
    password?: string
  }>({})
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setFieldErrors({})
    setPassword('')
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {}
    if (mode === 'register') {
      const trimmed = name.trim()
      if (trimmed.length < 2 || !NAME_RE.test(trimmed)) {
        errors.name = 'El nombre solo puede tener letras y espacios'
      }
    }
    if (!EMAIL_RE.test(email.trim())) {
      errors.email = 'Ingresa un correo electrónico válido'
    }
    if (password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setBusy(true)

    if (mode === 'register') {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      })
      setBusy(false)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      setMode('login')
      setPassword('')
      setError('')
      setFieldErrors({})
      setNotice('Revisa tu correo para confirmar tu cuenta y luego inicia sesión.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signInError) {
      setError('Correo o contraseña incorrectos')
    }
  }

  const [notice, setNotice] = useState('')

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
            {FEATURES.map((f, i) => (
              <li
                key={f.text}
                className="flex animate-form-in items-center gap-4 text-pine-100"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface/10">
                  <f.icon size={18} />
                </span>
                <span className="text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-pine-300">Hecho para hogares colombianos 🇨🇴</p>
      </div>

      {/* Formulario */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Cabecera */}
          <div key={`header-${mode}`} className="animate-form-in mb-8 text-center lg:text-left">
            <AppLogo size={64} className="mx-auto mb-4 lg:hidden" />
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-600">
              Fondo común
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              {mode === 'login' ? '¡Hola de nuevo!' : 'Crea tu cuenta'}
            </h2>
            <p className="mt-1.5 text-sm text-ink/50">
              {mode === 'login'
                ? 'Ingresa para gestionar las finanzas de tu hogar'
                : 'Empieza a organizar los gastos de tu hogar'}
            </p>
          </div>

          {/* Formulario (se anima al cambiar de modo) */}
          <form
            key={`form-${mode}`}
            onSubmit={handleSubmit}
            noValidate
            className="animate-form-in space-y-4"
          >
            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink/70">Nombre</label>
                <div className="relative">
                  <User
                    size={17}
                    className={cn(
                      'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                      fieldErrors.name ? 'text-coral-500' : 'text-ink/35',
                    )}
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }))
                    }}
                    className={cn(
                      inputBase,
                      fieldErrors.name ? inputBad : inputOk,
                      fieldErrors.name && 'animate-shake',
                    )}
                    autoComplete="name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    aria-invalid={!!fieldErrors.name}
                    placeholder="Tu nombre"
                  />
                </div>
                <FieldError message={fieldErrors.name} />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  size={17}
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                    fieldErrors.email ? 'text-coral-500' : 'text-ink/35',
                  )}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
                  }}
                  className={cn(
                    inputBase,
                    fieldErrors.email ? inputBad : inputOk,
                    fieldErrors.email && 'animate-shake',
                  )}
                  autoComplete="email"
                  autoCapitalize="none"
                  inputMode="email"
                  enterKeyHint="next"
                  aria-invalid={!!fieldErrors.email}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <FieldError message={fieldErrors.email} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink/70">Contraseña</label>
              <div className="relative">
                <Lock
                  size={17}
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                    fieldErrors.password ? 'text-coral-500' : 'text-ink/35',
                  )}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password)
                      setFieldErrors((f) => ({ ...f, password: undefined }))
                  }}
                  className={cn(
                    inputBase,
                    'pr-12',
                    fieldErrors.password ? inputBad : inputOk,
                    fieldErrors.password && 'animate-shake',
                  )}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  autoCapitalize="none"
                  enterKeyHint="done"
                  aria-invalid={!!fieldErrors.password}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-ink/40 transition-colors hover:text-ink/70"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
            </div>

            {notice && (
              <p className="animate-form-in flex items-start gap-2 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-600">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group relative min-h-12 w-full overflow-hidden rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 py-3 text-[15px] font-semibold text-white shadow-lg shadow-pine-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pine-900/30 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {busy
                ? 'Procesando…'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
            </button>
          </form>

          {/* Cambio de apartado */}
          <div key={`switch-${mode}`} className="animate-form-in mt-6 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-ink/50">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="group inline-flex items-center gap-1 font-semibold text-pine-600 transition-colors hover:text-pine-700"
                >
                  Crea una aquí
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              </p>
            ) : (
              <p className="text-sm text-ink/50">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="group inline-flex items-center gap-1 font-semibold text-pine-600 transition-colors hover:text-pine-700"
                >
                  Inicia sesión
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
