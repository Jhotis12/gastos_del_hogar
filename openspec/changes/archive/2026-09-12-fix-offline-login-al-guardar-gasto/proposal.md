## Why

Al registrar un gasto sin conexión (o con conectividad intermitente) la app muestra ocasionalmente la pantalla de login, aunque la sesión sigue siendo válida. El origen es una carrera entre el refresh de tokens de Supabase Auth y el fallback offline: ciertos fallos de red se clasifican como `SIGNED_OUT`/`INITIAL_SESSION=null` y borran `localStorage`, lo que hace que `useAuth` pierda `user` y los guards `RequireAuth` redirijan a `/login`. Un fix previo (commit `9bedfff`) ya blindó parte del flujo, pero el reporte indica que el síntoma persiste en algunos escenarios (WiFi conectado sin internet, portal cautivo, `getSession`/`getUser` concurrentes durante la mutación).

## What Changes

- **Blindaje de sesión offline**: `useAuth` nunca limpia `user` por un error de red transitorio. Solo un `signOut()` explícito del usuario o una confirmación del servidor (`getUser()` → 401/usuario inexistente) puede cerrar la sesión. Cualquier `onAuthStateChange(null)` o fallo de `getSession`/`getUser` con `isNetworkError` o `AuthRetryableFetchError` restaura y re-persiste la última sesión conocida (`sessionRef` + `localStorage`).
- **Detección de red robusta**: no depender solo de `navigator.onLine` (falsos positivos en WiFi sin internet). Centralizar `isNetworkError(err)` + `isAuthRetryableFetchError` como criterio para tratar fallos como transitorios en `useAuth`, `offlineAwareFetch` y `sync.ts`.
- **Boot y perfil resilientes**: `bootSession()` con timeout 2.5s + fallback a `readStoredSession()`; query `profile` con `networkMode: offlineFirst` y sin `signOut` ante `AuthRetryableFetchError`; `OffineWait`/`OfflineGate` distingue "sin red y sin caché" de "sesión expirada".
- **Mutaciones offline seguras**: `runWithOfflineFallback` + `offlineAwareFetch` garantizan que `supabase.from('expenses').insert` falle rápido sin disparar refresh innecesario; actualización optimista + `enqueue*` + `invalidateIfOnline` (sin invalidar sin red).
- **Sincronización y realtime sin pisar sesión**: `syncNow()` y `useRealtimeSync` verifican sesión con tolerancia a errores de red; `initOfflineWatcher` no emite `handleOffline` como cierre de sesión.
- **Observabilidad y tests**: logging discreto de eventos `INITIAL_SESSION/SIGNED_OUT` restaurados; test e2e/manual que reproduce "gasto offline → no debe ir a /login".

## Capabilities

### New Capabilities
- `auth/offline-resilience`: sesión persistida y restaurada ante fallos de red transitorios; boot resiliente, re-persistencia y criterio único de cierre de sesión (explícito o 401 del servidor).
- `offline/offline-mode`: cola FIFO en IndexedDB, fallback optimista de mutaciones, sincronización al reconectar y distinción entre errores de red y errores reales (RLS/validación).

### Modified Capabilities
<!-- No hay specs previos en openspec/specs; todo se introduce como nuevo. Si ya existiera auth/offline, se listaría aquí como modificado. -->

## Impact

- **Código afectado**: `src/shared/hooks/useAuth.tsx`, `src/shared/lib/supabase.ts` (fetch wrapper), `src/shared/lib/offline/*` (`offlineSafe.ts`, `queue.ts`, `sync.ts`, `optimistic.ts`, `persister.ts`), `src/main.tsx` (QueryClient `networkMode`, `initOfflineWatcher`), `src/shared/hooks/useRealtimeSync.ts`, `src/App.tsx` (guards `RequireAuth`/`RequireHousehold` + `OfflineWait`), `src/modules/expenses/hooks/useExpenses.ts` (y `useMembers`/`useIncomes` por simetría).
- **APIs/dependencias**: Supabase Auth (`getSession`, `getUser`, `onAuthStateChange`, `isAuthRetryableFetchError`), TanStack Query (`offlineFirst`, persister `idb`), `navigator.onLine` (solo como hint, no como verdad).
- **Riesgos**: si se restaura una sesión realmente revocada se retrasa el logout hasta el próximo `getUser` exitoso; mitigado con verificación `getUser` cuando hay red y `refreshPendingCount`/`syncNow` periódicos.
- **No objetivos**: no se toca producción ni esquema de BD, no se cambia RLS/RPCs, no se altera el modelo de datos offline (at-least-once idempotente ya existente).
