import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Tags,
  Repeat,
  LogOut,
  CalendarDays,
  PiggyBank,
  MoreHorizontal,
  X,
  Settings,
  History,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { useRealtimeSync } from '@/shared/hooks/useRealtimeSync'
import { useRunDueSalaries } from '@/modules/members/hooks/useMembers'
import { useRunDueSavings } from '@/modules/savings/hooks/useSavingsMovements'
import { useDragToClose } from '@/shared/hooks/useDragToClose'
import { useDialogA11y } from '@/shared/hooks/useDialogA11y'
import { cn } from '@/shared/lib/utils'
import AppLogo from '@/shared/components/ui/AppLogo'
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog'
import ThemeToggle from '@/shared/components/ui/ThemeToggle'
import InstallAppButton from '@/shared/components/ui/InstallAppButton'
import UserAvatar from '@/shared/components/ui/UserAvatar'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/proyeccion', label: 'Mi proyección', icon: TrendingUp },
  { to: '/quiero-comprar', label: 'Quiero comprar', icon: ShoppingBag },
  { to: '/miembros', label: 'Miembros e ingresos', icon: Users },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/recurrentes', label: 'Servicios', icon: Repeat },
  { to: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/perfil', label: 'Perfil y Hogar', icon: Settings },
]

// Navegación inferior (móvil): los 4 principales + "Más"
const BOTTOM_NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { to: '/recurrentes', label: 'Servicios', icon: Repeat },
]

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <AppLogo size={44} />
      <div>
        <p className="font-display text-sm font-semibold text-ink">Gastos del Hogar</p>
        <p className="text-xs text-ink/50">Finanzas del hogar</p>
      </div>
    </div>
  )
}

function SidebarNav() {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-pine-50 text-pine-600 shadow-sm shadow-pine-900/5'
                : 'text-ink/55 hover:bg-cream hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={18} className={isActive ? '' : 'text-ink/40'} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const goToProfilePhoto = () => navigate('/perfil?seccion=cuenta')
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const runDueSavings = useRunDueSavings()
  const runDueSavingsMutate = runDueSavings.mutate
  const runDueSalaries = useRunDueSalaries()
  const runDueSalariesMutate = runDueSalaries.mutateAsync
  useRealtimeSync(profile?.household_id ?? null)

  // Nóminas automáticas y autoahorro al abrir/reconectar. Primero la
  // nómina (para que el disponible del mes la tenga en cuenta) y luego
  // el autoahorro. Ambos RPC son idempotentes.
  useEffect(() => {
    if (!profile?.household_id) return
    const run = async () => {
      if (!navigator.onLine) return
      try {
        await runDueSalariesMutate()
      } catch {
        // Sin nómina no se bloquea el autoahorro ni el drenado offline.
      }
      runDueSavingsMutate()
    }
    void run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [profile?.household_id, runDueSalariesMutate, runDueSavingsMutate])

  const handleSignOut = async () => {
    setConfirmSignOut(false)
    await signOut()
  }

  const closeMore = () => setMoreOpen(false)
  const moreDrag = useDragToClose(closeMore)
  const moreRequestClose = moreDrag.requestClose
  // Sheet "Más": mismo comportamiento de diálogo que el Modal compartido.
  useDialogA11y(moreOpen, moreRequestClose, moreDrag.panelRef)

  return (
    <div className="min-h-screen bg-cream">
      {/* Acceso rápido por teclado: saltar directamente al contenido */}
      <a
        href="#contenido"
        className="sr-only z-[100] rounded-lg bg-pine-700 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-ink/10 bg-surface/70 backdrop-blur lg:block">
        <div className="flex h-full flex-col">
          <div className="px-6 py-5">
            <Brand />
          </div>

          <nav className="mt-2 flex-1 space-y-1 px-3">
            <SidebarNav />
          </nav>

          <div className="border-t border-slate-200/70 p-4">
            <button
              type="button"
              onClick={goToProfilePhoto}
              title="Ir a mi perfil"
              className="mb-4 flex w-full items-center gap-3 rounded-xl px-3 py-1 text-left transition-colors hover:bg-cream"
            >
              <UserAvatar
                name={profile?.full_name}
                avatarPath={profile?.avatar_path}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {profile?.full_name || 'Sin nombre'}
                </p>
                <p className="text-xs text-ink/40">Miembro de este hogar</p>
              </div>
            </button>
            <ThemeToggle />
            <button
              onClick={() => setConfirmSignOut(true)}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink/55 hover:bg-coral-100/60 hover:text-coral-600"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/10 bg-cream/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <AppLogo size={36} />
            <p className="font-display text-sm font-semibold text-ink">Gastos del Hogar</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={goToProfilePhoto}
              aria-label="Ir a mi perfil"
              className="rounded-full transition-transform hover:scale-105 active:scale-95"
            >
              <UserAvatar
                name={profile?.full_name}
                avatarPath={profile?.avatar_path}
                size="sm"
              />
            </button>
          </div>
        </header>

        <main
          id="contenido"
          className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-6"
        >
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior (móvil) */}
      <div
        role="navigation"
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                  isActive ? 'text-pine-600' : 'text-ink/45',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="Más opciones"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
              moreOpen ? 'text-pine-600' : 'text-ink/45',
            )}
          >
            {moreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
            Más
          </button>
        </div>
      </div>

      {/* Sheet "Más" (móvil) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMore} />
          <div
            ref={moreDrag.panelRef}
            style={moreDrag.style}
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones"
            className={cn(
              'animate-sheet-up absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl',
              !moreDrag.dragging && !moreDrag.closing && 'transition-transform duration-300 ease-out',
            )}
          >
            <div
              {...moreDrag.handleProps}
              className="mb-1 flex shrink-0 touch-none justify-center py-2"
            >
              <span
                className={cn(
                  'h-1 w-10 rounded-full transition-colors duration-200',
                  moreDrag.touching ? 'bg-pine-500' : moreDrag.dragging ? 'bg-pine-600' : 'bg-ink/10',
                )}
              />
            </div>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
              Más opciones
            </p>
            <div className="space-y-1">
              {NAV_ITEMS.slice(1).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={moreRequestClose}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-pine-50 text-pine-600' : 'text-ink/70 hover:bg-cream',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? '' : 'text-ink/40'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
              <InstallAppButton />
              <ThemeToggle />
              <button
                onClick={() => {
                  setMoreOpen(false)
                  setConfirmSignOut(true)
                }}
                className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-coral-600 hover:bg-coral-100/60"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de cierre de sesión */}
      <ConfirmDialog
        open={confirmSignOut}
        title="Cerrar sesión"
        message="¿Seguro que quieres cerrar la sesión? Tendrás que volver a ingresar con tu correo y contraseña."
        confirmLabel="Cerrar sesión"
        onConfirm={() => void handleSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  )
}
