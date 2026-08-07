import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import SessionSync from '@/components/ui/SessionSync'
import OfflineBanner from '@/components/ui/OfflineBanner'
import UpdatePrompt from '@/components/ui/UpdatePrompt'
import { queryPersister } from '@/shared/lib/offline/persister'
import { initOfflineWatcher, attachQueryClient } from '@/shared/lib/offline/sync'
import { supabaseUrl } from '@/shared/lib/supabase'

// Aplicar tema guardado antes del primer render (evita parpadeo)
{
  const saved = localStorage.getItem('theme')
  const dark = saved
    ? saved === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
}

// Ajuste "reducir animaciones" antes del primer render
if (localStorage.getItem('reduce-animations') === '1') {
  document.documentElement.classList.add('reduce-animations')
}

// Paleta de colores guardada antes del primer render
{
  const palette = localStorage.getItem('palette')
  if (palette) document.documentElement.dataset.palette = palette
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      // Sin red no refetchar por foco (evita intentos bloqueados por CORS).
      refetchOnWindowFocus: () => navigator.onLine,
      // Sin red: sirve la caché persistida sin errores; al volver, reintenta.
      networkMode: 'offlineFirst',
      // Cada query exitosa se guarda en IndexedDB y se sirve en un arranque
      // sin conexión (últimos datos conocidos).
      persister: queryPersister.persisterFn,
    },
    mutations: {
      // Sin red, las mutaciones con networkMode 'online' (default) quedan
      // "paused" para siempre y nunca ejecutan el mutationFn. Con 'always'
      // se intentan y nuestro runWithOfflineFallback encola en el outbox.
      networkMode: 'always',
    },
  },
})

attachQueryClient(queryClient)
initOfflineWatcher()

// Conexión temprana al backend: preconnect/dns-prefetch al host de Supabase
// configurado (local o producción), antes de que las queries lo necesiten.
{
  try {
    const host = new URL(supabaseUrl ?? 'https://placeholder.supabase.co').origin
    for (const rel of ['preconnect', 'dns-prefetch']) {
      const link = document.createElement('link')
      link.rel = rel
      link.href = host
      document.head.appendChild(link)
    }
  } catch {
    /* host inválido — se ignora */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionSync />
        <ToastProvider>
          <OfflineBanner />
          <UpdatePrompt />
          <App />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
