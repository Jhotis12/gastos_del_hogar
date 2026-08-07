import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useDragToClose } from '@/hooks/useDragToClose'
import { cn } from '@/shared/lib/utils'
import AppLogo from '@/components/ui/AppLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import InstallAppButton from '@/components/ui/InstallAppButton'
import UserAvatar from '@/components/ui/UserAvatar'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/proyeccion', label: 'Proyección', icon: TrendingUp },
  { to: '/miembros', label: 'Miembros y Salarios', icon: Users },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/recurrentes', label: 'Servicios', icon: Repeat },
  { to: '/ahorros', label: 'Metas de ahorro', icon: PiggyBank },
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
        <p className="text-xs text-ink/50">Presupuesto en común</p>
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
  const [moreOpen, setMoreOpen] = useState(false)
  useRealtimeSync(profile?.household_id ?? null)

  const closeMore = () => setMoreOpen(false)
  const moreDrag = useDragToClose(closeMore)
  const moreRequestClose = moreDrag.requestClose

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

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
            <div className="mb-4 flex items-center gap-3 px-3">
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
            </div>
            <ThemeToggle />
            <button
              onClick={signOut}
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
            <span className="hidden max-w-[6rem] truncate text-xs text-ink/50 min-[400px]:inline">
              {profile?.full_name}
            </span>
            <UserAvatar
              name={profile?.full_name}
              avatarPath={profile?.avatar_path}
              size="sm"
            />
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
                  <item.icon size={18} className="text-ink/40" />
                  {item.label}
                </NavLink>
              ))}
              <InstallAppButton />
              <ThemeToggle />
              <button
                onClick={signOut}
                className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-coral-600 hover:bg-coral-100/60"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
