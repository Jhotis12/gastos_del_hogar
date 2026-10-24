## Purpose

Garantiza que la sesión del usuario no se pierda por fallos de red transitorios al guardar datos offline, distinguiendo cierres reales de sesión de errores temporales.

## Requirements

### Requirement: Sesión nunca se cierra por error de red transitorio
El sistema SHALL preservar la sesión activa cuando un fallo de red interrumpa `getSession`, `getUser` o el evento `onAuthStateChange` con `session=null`. Solo un `signOut()` explícito del usuario o una confirmación del servidor (usuario no existe / 401 no retryable) SHALL cerrar la sesión y redirigir a `/login`.

#### Scenario: Gasto offline no muestra login
- **WHEN** el usuario agrega un gasto mientras `navigator.onLine` es `false` o `supabase` falla con `TypeError("Network request failed")` / `AuthRetryableFetchError`
- **THEN** la app mantiene `user` no nulo, permanece en la ruta actual (`/gastos` o `/`), muestra toast "Guardado sin conexión" y no navega a `/login`

#### Scenario: Evento INITIAL_SESSION nulo sin red restaura sesión
- **WHEN** `onAuthStateChange` emite `INITIAL_SESSION` con `newSession=null` y existe una sesión previa en `sessionRef` o en `localStorage` (`sb-*-auth-token`)
- **THEN** el sistema restaura esa sesión en memoria, la re-persiste en `localStorage` y mantiene `loading=false` sin cerrar sesión

#### Scenario: Evento SIGNED_OUT por refresh fallido con portal cautivo no cierra sesión
- **WHEN** `onAuthStateChange` emite `SIGNED_OUT` con `newSession=null` pero `navigator.onLine` es `true` y el fallo subyacente es de red (fetch no-JSON, 4xx de proxy, `isNetworkError`)
- **THEN** el sistema NO aplica `applySession(null)`; conserva `sessionRef`, ejecuta `persistSessionToStorage(fallback)` y trata el evento como transitorio

#### Scenario: Cierre explícito sí cierra sesión aunque haya fallback
- **WHEN** el usuario ejecuta `signOut()` (flag `signOutRef=true`) y luego llega `SIGNED_OUT` con `newSession=null`
- **THEN** el sistema aplica `applySession(null)`, limpia `QueryClient` y `clearPersistedCache()`, y los guards redirigen a `/login` en la próxima evaluación

#### Scenario: Sesión realmente revocada sí cierra sesión con red
- **WHEN** hay conectividad y `supabase.auth.getUser()` responde sin usuario y sin `isAuthRetryableFetchError` (error no retryable, 401 del servidor)
- **THEN** el sistema ejecuta `signOut` interno, limpia la sesión y navega a `/login`

### Requirement: Boot de sesión resiliente con timeout y fallback local
El sistema SHALL resolver la sesión inicial en ≤2.5s mediante `Promise.race(getSession, timeout)` y, si falla o retorna null, SHALL intentar `readStoredSession()` desde `localStorage` (clave computada `sb-<host>-auth-token` y escaneo de respaldo `sb-*-auth-token`) antes de marcar `loading=false`.

#### Scenario: Boot sin red sirve sesión persistida
- **WHEN** la app arranca sin red y `getSession()` hace timeout o rechaza con error de red
- **THEN** `bootSession()` retorna la sesión de `localStorage` si existe, `AuthProvider` fija `user` y `profile` se resuelve desde la caché persistida (`queryPersister`), sin mostrar `OfflineGate` salvo que no haya datos cacheados tras 3s

#### Scenario: Boot con red y sesión válida usa getSession
- **WHEN** hay red y `getSession()` retorna `session` no nula dentro del timeout
- **THEN** se usa esa sesión directamente sin leer `localStorage`

#### Scenario: Primera vez sin red ni datos muestra OfflineGate
- **WHEN** no hay red y no existe sesión en `localStorage` ni caché de `profile`
- **THEN** tras 3s `OfflineWait` renderiza `<OfflineGate>` en lugar de skeleton infinito o redirección a `/login`

### Requirement: Perfil offline no fuerza logout
La query `['profile', userId]` SHALL usar `networkMode: offlineFirst` y SHALL distinguir `AuthRetryableFetchError` (no cierra sesión, se pausa hasta reconectar) de error no retryable (sí cierra). Ante fallo de red al validar `getUser()` dentro del `queryFn`, SHALL continuar y dejar que el persister sirva el último perfil conocido.

#### Scenario: Validación de usuario con error retryable no cierra sesión
- **WHEN** `supabase.auth.getUser()` falla con `isAuthRetryableFetchError=true` dentro del `queryFn` de `profile`
- **THEN** la query no ejecuta `signOut()`, retorna o pausa sin error visible, y los guards `RequireHousehold`/`RequireSetup` permanecen en `OfflineWait` sirviendo caché

#### Scenario: Guards esperan profileLoaded sin navegar prematuramente
- **WHEN** `profileLoading=true` o `!profileLoaded` y `loading=false` con `user` no nulo
- **THEN** `RequireHousehold` y `RequireSetup` renderizan `OfflineWait` y no ejecutan `Navigate` a `/login` ni a `/setup`

### Requirement: Re-persistencia de sesión tras restauración
Toda restauración de sesión desde `sessionRef` o `localStorage` ante un evento nulo SHALL re-persistir la sesión en `localStorage` en el formato que `supabase-js` espera (`access_token`, `refresh_token`, `user`, etc.), para que el próximo `getSession()` al reconectar pueda refrescar el token y drenar la cola offline.

#### Scenario: Sesión restaurada se re-persiste
- **WHEN** `onAuthStateChange(null)` restaura `fallback` por `!navigator.onLine`
- **THEN** `persistSessionToStorage(fallback)` escribe `localStorage[computedAuthStorageKey]` y un `getSession()` posterior tras `online` renueva el token

### Requirement: Criterio único de error de red

El sistema SHALL centralizar la detección de errores de red en dos capas:
`isPureNetworkError(err)`, clasificador puro que solo inspecciona el error
(`TypeError` de fetch, mensajes `fetch failed`/`Network request failed`/
`ERR_INTERNET_DISCONNECTED`) y NO lee `navigator`; y el wrapper
`isNetworkError(err)` = `isPureNetworkError(err) || !navigator.onLine`, que es
el criterio para tratar un flujo como transitorio. Ese criterio, junto con
`isAuthRetryableFetchError` de `@supabase/supabase-js`, SHALL usarse en
`useAuth`, `supabase.ts` (`offlineAwareFetch`) y `offline/sync.ts`.

#### Scenario: WiFi conectado sin internet se trata como offline

- **WHEN** `navigator.onLine===true` pero `fetch` a Supabase rechaza con `TypeError: Failed to fetch` o respuesta no-JSON de portal cautivo
- **THEN** `isNetworkError` retorna `true` y el flujo se clasifica como transitorio (no logout, encola en outbox)

#### Scenario: Error retryable de auth también reintenta el drenado

- **WHEN** `offline/sync.ts` recibe `isAuthRetryableFetchError` al reproducir una operación encolada
- **THEN** el drenado se detiene con `retry` (no descarta el ítem) y el heartbeat lo reintenta

#### Scenario: El clasificador puro no depende del navegador

- **WHEN** se llama `isPureNetworkError` con un error que no es de red y `navigator.onLine===false`
- **THEN** retorna `false`: el estado del navegador lo aporta únicamente el wrapper `isNetworkError`
