import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'
import { cn, errorMessage } from '@/shared/lib/utils'
import { useToast } from '@/shared/components/ui/Toast'
import { usePageTitle } from '@/shared/hooks/usePageTitle'

const inputBase =
  'w-full rounded-xl border bg-surface py-3 pl-11 pr-4 text-base text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-colors'
const inputOk = 'border-slate-200 focus:border-pine-500 focus:ring-pine-500/20'

// Nueva contraseña tras el enlace de recuperación: el flujo de Supabase
// (resetPasswordForEmail → verify) llega aquí con sesión activa.
export default function Recover() {
  usePageTitle('Nueva contraseña')
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Llegada directa sin el flujo de recuperación (sin sesión ni token)
    if (loading) return
    if (!user && !params.get('token_hash')) {
      setError('Este enlace no es válido. Solicita uno nuevo desde el inicio de sesión.')
    }
  }, [user, loading, params])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!user) {
      setError('Tu sesión no está activa. Solicita un nuevo enlace de recuperación.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      toast.success('Contraseña actualizada')
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Redirección declarativa: el destino final (hogar, setup o login) lo
  // resuelven los guards de App.tsx, no este formulario.
  if (saved) return <Navigate to="/" replace />

  return (
    <div className="force-light flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-lg shadow-pine-900/20">
          <Lock size={24} />
        </div>
        <h1 className="font-display text-lg font-bold tracking-tight text-ink">
          Nueva contraseña
        </h1>
        <p className="mt-1.5 text-sm text-ink/50">
          Elige una contraseña nueva para tu cuenta
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="rec-new" className="mb-1.5 block text-sm font-medium text-ink/70">
              Contraseña nueva
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35"
              />
              <input
                id="rec-new"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                className={cn(inputBase, inputOk)}
                autoComplete="new-password"
                autoCapitalize="none"
                enterKeyHint="next"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rec-confirm" className="mb-1.5 block text-sm font-medium text-ink/70">
              Confirma la contraseña
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35"
              />
              <input
                id="rec-confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                className={cn(inputBase, inputOk)}
                autoComplete="new-password"
                autoCapitalize="none"
                enterKeyHint="done"
                placeholder="••••••••"
              />
            </div>
            {capsLock && (
              <p aria-live="polite" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gold-600">
                <AlertCircle size={13} className="shrink-0" />
                Bloq Mayús activado
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-coral-100/60 px-4 py-3 text-sm text-coral-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          {user && !error && (
            <p className="flex items-start gap-2 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-600">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              Sesión verificada — ya puedes cambiar la contraseña.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 py-3 text-base font-semibold text-white shadow-lg shadow-pine-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-ink/50 transition-colors hover:text-ink/75"
          >
            <ArrowLeft size={15} />
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    </div>
  )
}
