import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/shared/lib/supabase'

export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    const tokenHash = params.get('token_hash')
    const type = params.get('type')
    const next = params.get('next') || (type === 'recovery' ? '/recuperar' : '/')

    if (!tokenHash || !type) {
      setError('Enlace de confirmación inválido o expirado.')
      return
    }

    let active = true
    const timer = setTimeout(() => {
      if (active && !doneRef.current) setError('La confirmación está tardando. Revisa tu conexión e intenta de nuevo.')
    }, 12000)

    supabase.auth
      .verifyOtp({
        token_hash: tokenHash,
        type: type as 'email' | 'sms' | 'email_change' | 'recovery',
      })
      .then(({ error: verifyError }) => {
        clearTimeout(timer)
        if (verifyError) {
          setError('El enlace de confirmación no es válido o ya fue usado.')
          return
        }
        doneRef.current = true
        setDone(true)
        navigate(next, { replace: true })
      })
      .finally(() => {
        active = false
        clearTimeout(timer)
      })
  }, [params, navigate])

  return (
    <div className="force-light flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-lg shadow-pine-900/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="font-display text-lg font-bold tracking-tight text-ink">
          {done
            ? params.get('type') === 'recovery'
              ? '¡Contraseña verificada!'
              : '¡Correo confirmado!'
            : params.get('type') === 'recovery'
              ? 'Verificando tu enlace…'
              : 'Confirmando tu correo…'}
        </h1>
        {done ? (
          <p className="mt-2 text-sm text-pine-600">Redirigiendo a tu sesión…</p>
        ) : error ? (
          <>
            <h2 className="mt-2 font-display text-base font-bold text-coral-600">
              Enlace inválido o expirado
            </h2>
            <p className="mt-1.5 text-sm text-ink/60">{error}</p>
            <p className="mt-3 text-xs leading-relaxed text-ink/45">
              Los enlaces de confirmación vencen en 1 hora. Inicia sesión y
              vuelve a registrarte si el correo no te llegó para recibir uno nuevo.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
            >
              Ir a iniciar sesión
            </Link>
          </>
        ) : (
          <div className="mx-auto mt-6 flex items-center justify-center gap-2 text-sm text-ink/50">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-pine-500" />
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-pine-500" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-pine-500" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}
