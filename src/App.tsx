import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { useOfflineStatus } from '@/shared/hooks/useOffline'
import Layout from '@/shared/components/layout/Layout'
import PageSkeleton from '@/shared/components/ui/PageSkeleton'
import OfflineGate from '@/shared/components/ui/OfflineGate'

// Lazy loading: cada página se carga solo cuando se navega a ella
const Login = lazy(() => import('@/modules/auth/Login'))
const Setup = lazy(() => import('@/modules/auth/Setup'))
const AuthConfirm = lazy(() => import('@/modules/auth/AuthConfirm'))
const Recover = lazy(() => import('@/modules/auth/Recover'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const History = lazy(() => import('@/pages/History'))
const Members = lazy(() => import('@/modules/members/Members'))
const Expenses = lazy(() => import('@/modules/expenses/Expenses'))
const Recurring = lazy(() => import('@/modules/services/Recurring'))
const Savings = lazy(() => import('@/modules/savings/Savings'))
const Forecast = lazy(() => import('@/pages/Forecast'))
const Categories = lazy(() => import('@/pages/Categories'))
const Profile = lazy(() => import('@/modules/profile/Profile'))

// Dev: no hay service worker, así que navegar a una ruta lazy sin red
// falla (chunk no precacheado). Se pre-cargan todas las páginas al boot
// para que la navegación offline también funcione en desarrollo. En
// producción el SW precachea todos los chunks (generateSW → precache).
if (import.meta.env.DEV) {
  void Promise.allSettled([
    import('@/modules/auth/Login'),
    import('@/modules/auth/Setup'),
    import('@/modules/auth/AuthConfirm'),
    import('@/modules/auth/Recover'),
    import('@/pages/Dashboard'),
    import('@/pages/Calendar'),
    import('@/pages/History'),
    import('@/modules/members/Members'),
    import('@/modules/expenses/Expenses'),
    import('@/modules/services/Recurring'),
    import('@/modules/savings/Savings'),
    import('@/pages/Forecast'),
    import('@/pages/Categories'),
    import('@/modules/profile/Profile'),
  ])
}

// Espera con skeleton; si tras unos segundos no hay red ni datos guardados,
// muestra una pantalla clara en vez de quedarse cargando para siempre.
function OfflineWait() {
  const { isOnline } = useOfflineStatus()
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 3000)
    return () => clearTimeout(t)
  }, [])

  if (!isOnline && waited) return <OfflineGate />
  return <PageSkeleton />
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <OfflineWait />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

// Si ya hay sesión, no mostrar el login (redirección declarativa)
function RequireGuest() {
  const { user, loading } = useAuth()
  if (loading) return <OfflineWait />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireHousehold() {
  const { user, loading, profile, profileLoading, profileLoaded } = useAuth()
  if (loading) return <OfflineWait />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading || !profileLoaded) return <OfflineWait />
  if (!profile || !profile.household_id) return <Navigate to="/setup" replace />
  return <Outlet />
}

function RequireSetup() {
  const { user, profile, profileLoading, profileLoaded, loading } = useAuth()
  if (loading) return <OfflineWait />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading || !profileLoaded) return <OfflineWait />
  if (profile?.household_id) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/recuperar" element={<Recover />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireSetup />}>
            <Route path="/setup" element={<Setup />} />
          </Route>
          <Route element={<RequireHousehold />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendario" element={<Calendar />} />
              <Route path="/historial" element={<History />} />
              <Route path="/proyeccion" element={<Forecast />} />
              <Route path="/miembros" element={<Members />} />
              <Route path="/gastos" element={<Expenses />} />
              <Route path="/recurrentes" element={<Recurring />} />
              <Route path="/ahorros" element={<Savings />} />
              <Route path="/categorias" element={<Categories />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
