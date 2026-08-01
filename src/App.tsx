import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/ui/Loading'

// Lazy loading: cada página se carga solo cuando se navega a ella
const Login = lazy(() => import('@/pages/Login'))
const Setup = lazy(() => import('@/pages/Setup'))
const AuthConfirm = lazy(() => import('@/pages/AuthConfirm'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const Members = lazy(() => import('@/pages/Members'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Recurring = lazy(() => import('@/pages/Recurring'))
const Savings = lazy(() => import('@/pages/Savings'))
const Categories = lazy(() => import('@/pages/Categories'))
const Profile = lazy(() => import('@/pages/Profile'))

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

// Si ya hay sesión, no mostrar el login (redirección declarativa)
function RequireGuest() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireHousehold() {
  const { user, loading, profile, profileLoading, profileLoaded } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading || !profileLoaded) return <Loading />
  if (!profile || !profile.household_id) return <Navigate to="/setup" replace />
  return <Outlet />
}

function RequireSetup() {
  const { user, profile, profileLoading, profileLoaded, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading || !profileLoaded) return <Loading />
  if (profile?.household_id) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireSetup />}>
            <Route path="/setup" element={<Setup />} />
          </Route>
          <Route element={<RequireHousehold />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendario" element={<Calendar />} />
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
