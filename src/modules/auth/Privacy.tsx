import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import AppLogo from '@/shared/components/ui/AppLogo'
import { usePageTitle } from '@/shared/hooks/usePageTitle'

export default function Privacy() {
  usePageTitle('Política de Tratamiento de Datos')

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
              <ShieldCheck size={20} />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Política de Tratamiento de Datos
              </h1>
              <p className="text-xs text-ink/50">Última actualización: agosto de 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-ink/70">
            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">1. Datos que recopilamos</h2>
              <p>
                Para crear tu cuenta recopilamos tu nombre y correo electrónico. Con tu
                uso, registras la información que decides compartir con tu hogar:
                salarios, gastos, facturas escaneadas, servicios y metas de ahorro.
                Las facturas escaneadas se procesan automáticamente para extraer los
                montos; los archivos se guardan para que puedas consultarlos después.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">2. Finalidad</h2>
              <p>
                Usamos tus datos únicamente para prestar el servicio: registrar y
                consultar la información del hogar, calcular saldos y proyecciones,
                y permitir el acceso de los miembros que tú invites. No vendemos tus
                datos ni los usamos para publicidad.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">3. Almacenamiento y seguridad</h2>
              <p>
                Tus datos se almacenan en servicios en la nube (Supabase, alojado en
                proveedores de Google Cloud) con cifrado en tránsito. Los accesos
                están protegidos por autenticación y permisos por hogar: cada miembro
                solo ve la información de su propio hogar. La contraseña se guarda
                cifrada y nunca en texto plano.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">4. Tus derechos</h2>
              <p>
                De acuerdo con la Ley 1581 de 2012 de Colombia, puedes conocer,
                actualizar, rectificar y eliminar tus datos personales en cualquier
                momento desde la aplicación, y revocar tu consentimiento. Al eliminar
                tu cuenta o tu hogar, tus datos se borran de forma definitiva.
              </p>
            </section>

            <section>
              <h2 className="mb-1.5 font-display text-base font-semibold text-ink">5. Retención</h2>
              <p>
                Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu
                cuenta, los datos asociados se suprimen; las copias de seguridad se
                eliminan según el ciclo del proveedor de almacenamiento.
              </p>
            </section>
          </div>

          <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-ink/45">
            Al registrarte aceptas también los{' '}
            <Link to="/terminos" className="font-semibold text-pine-600 hover:underline">
              Términos y Condiciones
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  )
}
