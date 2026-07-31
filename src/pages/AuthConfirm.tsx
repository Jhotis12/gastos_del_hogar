import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const tokenHash = params.get('token_hash')
    const type = params.get('type')
    const next = params.get('next') || '/'

    if (!tokenHash || !type) {
      setError('Enlace de confirmación inválido o expirado.')
      return
    }

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: type as 'email' | 'sms' | 'email_change' })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setError('El enlace de confirmación no es válido o ya fue usado.')
          return
        }
        setDone(true)
        navigate(next, { replace: true })
      })
  }, [params, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-lg shadow-pine-900/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="font-display text-lg font-bold tracking-tight text-ink">
          {done ? '¡Correo confirmado!' : 'Confirmando tu correo…'}
        </h1>
        {done ? (
          <p className="mt-2 text-sm text-pine-600">Redirigiendo a tu sesión…</p>
        ) : error ? (
          <>
            <p className="mt-2 text-sm text-coral-600">{error}</p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800"
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
