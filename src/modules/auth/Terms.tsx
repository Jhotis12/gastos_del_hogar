import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import AppLogo from '@/shared/components/ui/AppLogo'
import { usePageTitle } from '@/shared/hooks/usePageTitle'

export default function Terms() {
  usePageTitle('Términos y Condiciones')

  return (
    <div className="force-light flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <p className="font-display text-sm font-bold text-ink">Gastos del Hogar</p>
          </div>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-pine-600 hover:bg-pine-50"
          >
            <ArrowLeft size={16} />
            Volver
          </Link>
        </div>

        <article className="card p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pine-600 to-pine-800 text-white">
              <FileText size={20} />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Términos y Condiciones
              </h1>
              <p className="text-xs text-ink/50">Última actualización: agosto de 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-ink/70">
            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">1. El servicio</h2>
              <p>
                Gastos del Hogar es una herramienta para que los miembros de un hogar lleven
                el registro de sus ingresos, gastos, servicios y metas de ahorro del hogar.
                Al crear una cuenta aceptas estos términos y te comprometes a usarla solo
                para fines personales y familiares.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">2. Cuentas y acceso</h2>
              <p>
                Eres responsable de mantener la confidencialidad de tu contraseña y de
                la información de tu hogar. El código de invitación que permite entrar a
                un hogar es confidencial: no lo compartas con personas ajenas. Si crees
                que tu cuenta fue comprometida, cambia tu contraseña de inmediato.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">3. Información del hogar</h2>
              <p>
                Los datos que registras (salarios, gastos, facturas, metas) pertenecen a
                tu hogar y son visibles para los miembros que aceptes. Quien crea el
                hogar puede eliminar el hogar completo, lo que borra todos sus datos de
                forma definitiva.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">4. Disponibilidad</h2>
              <p>
                El servicio se ofrece "tal cual", sin garantías de disponibilidad
                ininterrumpida. Podemos realizar mantenimientos o introducir cambios
                en la aplicación. No nos hacemos responsables por decisiones
                financieras tomadas con base en los cálculos de la aplicación.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">5. Cambios a estos términos</h2>
              <p>
                Podemos actualizar estos términos cuando la aplicación evolucione. La
                versión vigente se publica siempre en esta página.
              </p>
            </section>
          </div>

          <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-ink/45">
            Para saber cómo tratamos tus datos personales, consulta la{' '}
            <Link to="/privacidad" className="font-semibold text-pine-600 hover:underline">
              Política de Tratamiento de Datos
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  )
}
