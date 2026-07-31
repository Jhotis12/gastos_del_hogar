import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import Loading from '@/components/Loading'
import Login from '@/pages/Login'
import Setup from '@/pages/Setup'
import Dashboard from '@/pages/Dashboard'
import Calendar from '@/pages/Calendar'
import Members from '@/pages/Members'
import Expenses from '@/pages/Expenses'
import Recurring from '@/pages/Recurring'
import Savings from '@/pages/Savings'
import Categories from '@/pages/Categories'

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
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<Login />} />
        </Route>
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
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
