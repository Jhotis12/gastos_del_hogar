import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import AppLogo from '@/shared/components/ui/AppLogo'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

type Mode = 'login' | 'register'

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
      <AlertCircle size={14} className="shrink-0" />
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
    terms?: string
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
      if (!acceptedTerms) {
        errors.terms = 'Debes aceptar los términos y condiciones'
      }
    }
    if (!EMAIL_RE.test(email.trim())) {
      errors.email = 'Ingresa un correo electrónico válido'
    }
    if (password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres'
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
  const [capsLock, setCapsLock] = useState(false)
  const [view, setView] = useState<'login' | 'forgot'>('login')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email.trim())) {
      setFieldErrors({ email: 'Ingresa un correo electrónico válido' })
      return
    }
    setBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/recuperar`,
    })
    setBusy(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setView('login')
    setNotice('Te enviamos un enlace a tu correo para restablecer la contraseña.')
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

        <div className="relative flex w-full flex-col items-center">
          <h1 className="max-w-md text-center font-display text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            El presupuesto de tu hogar,
            <span className="text-gold-300"> en un solo lugar.</span>
          </h1>
          <div className="relative mt-10 w-full max-w-2xl">
            <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-gold-400/15 blur-2xl" />
            <video
              className="relative aspect-video w-full rounded-2xl border border-white/15 shadow-2xl shadow-pine-950/60"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/videos/promo-login-poster.jpg"
              aria-hidden="true"
              tabIndex={-1}
              disablePictureInPicture
            >
              <source src="/videos/promo-login.mp4" type="video/mp4" />
            </video>
          </div>
        </div>

        <p className="relative text-sm text-pine-300">Hecho para hogares colombianos 🇨🇴</p>
      </div>

      {/* Formulario */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {/* Cabecera */}
          <div key={`header-${mode}-${view}`} className="animate-form-in mb-8 text-center lg:text-left">
            <AppLogo size={64} className="mx-auto mb-4 lg:hidden" />
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-600">
              Finanzas del hogar
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              {view === 'forgot'
                ? 'Restablecer contraseña'
                : mode === 'login'
                  ? '¡Hola de nuevo!'
                  : 'Crea tu cuenta'}
            </h2>
            <p className="mt-1.5 text-sm text-ink/50">
              {view === 'forgot'
                ? 'Te enviaremos un enlace a tu correo para crear una nueva'
                : mode === 'login'
                  ? 'Ingresa para gestionar las finanzas de tu hogar'
                  : 'Empieza a organizar los gastos de tu hogar'}
            </p>
          </div>

          {/* Formulario (se anima al cambiar de modo/vista) */}
          {view === 'forgot' ? (
            <form key="form-forgot" onSubmit={handleForgot} noValidate className="animate-form-in space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-ink/70">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className={cn(
                      'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                      fieldErrors.email ? 'text-coral-500' : 'text-ink/35',
                    )}
                  />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
                    }}
                    className={cn(inputBase, fieldErrors.email ? inputBad : inputOk)}
                    autoComplete="email"
                    autoCapitalize="none"
                    inputMode="email"
                    enterKeyHint="done"
                    aria-invalid={!!fieldErrors.email}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <FieldError message={fieldErrors.email} />
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-12 w-full rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 py-3 text-base font-semibold text-white shadow-lg shadow-pine-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('login')
                  setError('')
                }}
                className="w-full rounded-lg py-2 text-sm font-medium text-ink/50 transition-colors hover:text-ink/75"
              >
                Volver a iniciar sesión
              </button>
            </form>
          ) : (
          <form
            key={`form-${mode}`}
            onSubmit={handleSubmit}
            noValidate
            className="animate-form-in space-y-4"
          >
            {mode === 'register' && (
              <div>
                <label htmlFor="login-nombre" className="mb-1.5 block text-sm font-medium text-ink/70">Nombre</label>
                <div className="relative">
                  <User
                    size={16}
                    className={cn(
                      'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                      fieldErrors.name ? 'text-coral-500' : 'text-ink/35',
                    )}
                  />
                  <input
                    id="login-nombre"
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
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-ink/70">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                    fieldErrors.email ? 'text-coral-500' : 'text-ink/35',
                  )}
                />
                <input
                  id="login-email"
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
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-medium text-ink/70">Contraseña</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot')
                      setError('')
                      setNotice('')
                    }}
                    className="text-xs font-medium text-pine-600 transition-colors hover:text-pine-700"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
                    fieldErrors.password ? 'text-coral-500' : 'text-ink/35',
                  )}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                  onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
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
              {mode === 'register' && (
                <label
                  className={cn(
                    'mt-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    fieldErrors.terms ? 'border-coral-200 bg-coral-100/40' : 'border-slate-200 bg-surface hover:border-pine-300',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked)
                      if (fieldErrors.terms) setFieldErrors((f) => ({ ...f, terms: undefined }))
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-pine-600"
                    aria-invalid={!!fieldErrors.terms}
                  />
                  <span className="text-xs leading-relaxed text-ink/60">
                    He leído y acepto los{' '}
                    <Link to="/terminos" target="_blank" className="font-semibold text-pine-600 underline-offset-2 hover:underline">
                      Términos y Condiciones
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacidad" target="_blank" className="font-semibold text-pine-600 underline-offset-2 hover:underline">
                      Política de Tratamiento de Datos
                    </Link>
                  </span>
                </label>
              )}
              {fieldErrors.terms && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-coral-600">
                  {fieldErrors.terms}
                </p>
              )}
              {capsLock && (
                <p aria-live="polite" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gold-600">
                  <AlertCircle size={13} className="shrink-0" />
                  Bloq Mayús activado
                </p>
              )}
            </div>

            {notice && (
              <p className="animate-form-in flex items-start gap-2 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-600">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group relative min-h-12 w-full overflow-hidden rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 py-3 text-base font-semibold text-white shadow-lg shadow-pine-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pine-900/30 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {busy
                ? 'Procesando…'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
            </button>
          </form>
          )}

          {/* Cambio de apartado */}
          {view !== 'forgot' && (
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
          )}
        </div>
      </div>
    </div>
  )
}
