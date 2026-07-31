import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Tags,
  Repeat,
  LogOut,
  Wallet,
  Menu,
  X,
  CalendarDays,
  PiggyBank,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/miembros', label: 'Miembros y Salarios', icon: Users },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/recurrentes', label: 'Servicios', icon: Repeat },
  { to: '/ahorros', label: 'Metas de ahorro', icon: PiggyBank },
  { to: '/categorias', label: 'Categorías', icon: Tags },
]

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pine-600 to-pine-800 text-white shadow-md shadow-pine-900/20">
        <Wallet size={20} />
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-ink">Gastos del Hogar</p>
        <p className="text-xs text-ink/50">Presupuesto en común</p>
      </div>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-pine-50 text-pine-700 shadow-sm shadow-pine-900/5'
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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-pine-950/5 bg-white/70 backdrop-blur lg:block">
        <div className="flex h-full flex-col">
          <div className="px-6 py-5">
            <Brand />
          </div>

          <nav className="mt-2 flex-1 space-y-1 px-3">
            <NavLinks />
          </nav>

          <div className="border-t border-slate-200/70 p-4">
            <div className="mb-3 flex items-center gap-2 px-3">
              <span className="text-xs text-ink/40">Miembro de:</span>
              <span className="truncate text-xs font-medium text-ink/60">
                {profile?.full_name}
              </span>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink/55 hover:bg-coral-100/60 hover:text-coral-700"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-pine-950/5 bg-cream/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-ink/50 hover:bg-white"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pine-600 to-pine-800 text-white">
              <Wallet size={16} />
            </div>
            <p className="font-display text-sm font-semibold text-ink">Gastos del Hogar</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-ink/50 hover:bg-white"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </header>

        {menuOpen && (
          <div className="animate-fade-up border-b border-pine-950/5 bg-white lg:hidden">
            <nav className="space-y-1 px-3 py-3">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
          </div>
        )}

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
