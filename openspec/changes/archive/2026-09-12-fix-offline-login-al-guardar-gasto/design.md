## Context

Ver `proposal.md` Why y `ARQUITECTURA.md` § Modo offline + § Historial bug #11. Estado actual:

- `useAuth.tsx:111-212` ya implementa `bootSession()` con timeout 2.5s, `sessionRef`/`signOutRef`, `applySession`, `readStoredSession()`/`persistSessionToStorage()` y en `onAuthStateChange(null)` restaura fallback si `!navigator.onLine` o verifica con `getUser()` si hay red. Fix del commit `9bedfff`.
- `supabase.ts:18-28` usa `offlineAwareFetch` que rechaza al instante si `!navigator.onLine`.
- `main.tsx:36-57` configura `QueryClient` con `networkMode: offlineFirst` (queries) / `always` (mutations) + `queryPersister` (`idb` + `offline/persister.ts`), `attachQueryClient` + `initOfflineWatcher`.
- `offline/*`: `queue.ts` (outbox FIFO IndexedDB), `offlineSafe.ts` (`isNetworkError`/`invalidateIfOnline`/`runWithOfflineFallback`), `optimistic.ts` (`enqueueExpenseAdd`/`Update`/`Delete` con `crypto.randomUUID()` + `setQueryData`), `sync.ts` (`replay` idempotente `23505`/`PGRST116`, `syncNow` FIFO, `handleOnline`/`handleOffline`, heartbeat 15s).
- `useRealtimeSync.ts` desconecta `supabase.realtime` sin red y resuscribe al volver.
- `App.tsx:56-100` guards `RequireAuth`/`RequireHousehold`/`RequireSetup` con `loading`/`profileLoaded` y `OfflineWait` (3s → `OfflineGate`).

Reporte: el síntoma persiste "en ocasiones" al agregar gasto. Hipótesis no cubiertas por el fix previo: `navigator.onLine` con falso positivo (WiFi conectado sin internet / portal cautivo) hace que `offlineAwareFetch` sí intente fetch y que `useAuth` entre por la rama "con red → `getUser()`" donde un error no-`AuthRetryableFetchError` pero de red (respuesta HTML 4xx, JSON inválido) borre la sesión; `isNetworkError` no se usa en esa rama; concurrencia `getSession` de `syncNow`/`handleOnline` vs mutación puede disparar refresh simultáneos.

## Goals / Non-Goals

**Goals:**
- Eliminar 100% de redirecciones espurias a `/login` por fallos transitorios al guardar gasto offline/intermitente.
- Unificar el criterio "error de red = transitorio" en todo el stack offline/auth.
- Hacer el boot y la sincronización tolerantes a `navigator.onLine` mentiroso.
- Mantener el contrato offline existente (at-least-once idempotente, optimistic, `invalidateIfOnline`).

**Non-Goals:**
- Cambiar modelo de datos, RLS, RPCs o esquema (`schema.sql`, migraciones).
- Soportar offline para facturas/storage/Edge Function Gemini, metas, presupuestos, categorías, servicios (siguen requiriendo red).
- Resolver conflictos multi-dispositivo más allá de last-write-wins.
- Introducir Service Worker propio o cambiar `vite-plugin-pwa`/`workbox` (el shell ya hace precache + `navigateFallback`).
- Reescribir `supabase-js` auth (solo envolver/interpretar sus señales).

## Decisions

### D1: Fuente de verdad para "es error de red" = `isNetworkError(err) || isAuthRetryableFetchError(err)`
- **Qué**: extraer `isNetworkError` a `shared/lib/offline/isNetworkError.ts` (puro, testeable) y usarlo + `isAuthRetryableFetchError` de `@supabase/supabase-js` en `useAuth` (ramas `onAuthStateChange(null)` y `profile.queryFn`), `supabase.ts` y `sync.ts`. En `useAuth:186-205` reemplazar `if (!navigator.onLine)` por `if (isNetworkError(fallbackErr) || !navigator.onLine)` y en el `catch` de `getUser` tratar `isNetworkError`/`isAuthRetryableFetchError` como transitorio.
- **Por qué**: `navigator.onLine` solo indica "interfaz conectada", no internet real. El síntoma intermitente coincide con WiFi con portal cautivo (hay `onLine=true` pero fetch devuelve HTML). El fix previo solo cubría `!navigator.onLine`.
- **Alternativa descartada**: confiar solo en `navigator.onLine` + timeouts → deja el hueco reportado. Sobrescribir `fetch` global para todos los hosts → rompería analytics/CDN.

### D2: Prioridad `sessionRef` > `localStorage` + re-persistencia siempre
- **Qué**: en `onAuthStateChange(null)` resolver `fallback = sessionRef.current ?? readStoredSession()` y, si se restaura, siempre `persistSessionToStorage(fallback)` incluso cuando la rama original era "con red pero `getUser` falló con error de red". Añadir `sessionRef` actualizado en cada `applySession` (ya existe) y no borrar `localStorage` en fallos transitorios.
- **Por qué**: `auth-js` puede borrar `localStorage` al clasificar un fallo como fatal (`_removeSession()`). Sin re-persistencia, el próximo `bootSession` no encuentra nada y la cola nunca drena.
- **Alternativa**: no re-persistir y confiar en `auth-js` → repro del bug.

### D3: `offlineAwareFetch` mantiene `!navigator.onLine` como fast-path, pero no como verdad final
- **Qué**: conservar el rechazo inmediato si `!navigator.onLine` (evita ruido CORS/backoff), pero en el caller (`runWithOfflineFallback`, `useAuth`, `sync.replay`) seguir clasificando el error resultante con `isNetworkError` para decidir encolar vs error real. No cambiar la semántica de `fetch` para `navigator.onLine=true` (dejar que `fetch` intente y falle, y clasificar después).
- **Por qué**: el fast-path ahorra recursos; la clasificación posterior cubre el falso positivo.

### D4: `syncNow` y `handleOnline` tolerantes a fallo de `getSession`
- **Qué**: `handleOnline` ya hace `getSession().catch(()=>{})` antes de `syncNow`; mantenerlo y en `syncNow` el loop `for(;;) { getSession(); if(!session) break; replay(op) }` tratar `getSession` con error de red como `retry` (no `break` definitivo). Añadir `try/catch` alrededor de `getSession` dentro del loop y clasificar con `isNetworkError`.
- **Alternativa**: abortar sync si no hay sesión → deja cola huérfana cuando la sesión está restaurada pero `getSession` aún no refleja el refresh.

### D5: `useRealtimeSync` mantiene `offlineRef` + `disconnect`/`removeChannel`
- **Qué**: sin cambios de API, solo asegurar que `onOffline`/`onOnline` usen el mismo `isNetworkError` si se añade chequeo de error de subscribe. Mantener `channel.subscribe()` sin reintentos propios (Supabase ya hace backoff).
- **Por qué**: evita tormenta de reconexiones que compite con el refresh de auth.

### D6: Observabilidad mínima sin PII
- **Qué**: `console.debug` (solo `import.meta.env.DEV`) en `useAuth:onAuthStateChange` cuando se restaura fallback (`[auth] restored session after null event, reason=...`) y en `sync.replay` cuando `retry`. No loguear tokens.
- **Alternativa**: `emitToast` para debug → ruido para usuario.

## Risks / Trade-offs

- **[Sesión revocada se restaura por ~15s] → Mitigación**: si el servidor revocó el refresh token, `getUser()` con red eventualmente responderá sin `isAuthRetryableFetchError` y el próximo `onAuthStateChange` limpiará la sesión. El retraso es aceptable vs logout espurio; documentar en spec.
- **[Falso positivo de `isNetworkError` oculta error real] → Mitigación**: regex de `isNetworkError` es conservadora (`TypeError` + mensajes `fetch`/`network`/`ERR_INTERNET_DISCONNECTED`); errores RLS/validación vienen como objeto con `code` (`42501`, `23505`, `PGRST*`) y nunca matchean.
- **[Re-persistir sesión stale prolonga token expirado] → Mitigación**: al reconectar `handleOnline` hace `getSession()` que dispara refresh de `auth-js`; si el refresh falla con 401, se limpia. No se extiende la vida del token más allá del refresh.
- **[Heartbeat 15s + `syncNow` concurrente] → Mitigación**: flag `draining` ya evita reentrancia; `syncNow` early-return si `draining || !isOnline`.
- **[IndexedDB quota] → Mitigación**: outbox solo guarda payload pequeño (gastos/incomes/salarios); `queryPersister` `maxAge 30d`; al hacer `signOut` se llama `clearPersistedCache()` y la cola se puede vaciar manualmente si supera N ítems (no implementado en este cambio).

## Migration Plan

1. **Deploy**: solo frontend (Vite build). Sin migraciones, sin `supabase db push`, sin `functions deploy`, sin cambios en `storage`/`RLS`. `pnpm build` + `pnpm lint` + `node tests/e2e-flow.mjs` (incluye paso `registros sin conexión y sincronización al reconectar`).
2. **Rollback**: revertir el commit del cambio; la versión previa sigue sirviendo caché `idb` (`buster v1` idéntico) y la cola FIFO es compatible (mismo `DB_NAME`/`STORE`). No hay migración de datos.
3. **Verificación post-deploy**: reproducir manualmente: `DevTools > Network > Offline`, agregar gasto → debe aparecer al instante con toast "Guardado sin conexión" y permanecer en `/gastos` (no `/login`); volver a Online → toast "De vuelta en línea" + "N cambios sincronizados" y persistencia tras recarga. Probar también `WiFi on + throttle Offline` y portal cautivo simulado (Mapear `supabaseUrl` a HTML 4xx).

## Open Questions

- ¿Conviene mover `isNetworkError` a `shared/lib/errors.ts` para reutilizar en `Forecast`/`Savings` si se offlinean en el futuro? No bloquea este cambio; se puede refinar en el apply.
- ¿Queremos un límite `MAX_QUEUE=50` con aviso "cola llena, conecta para sincronizar"? Fuera de alcance de este fix; anotado para próximo cambio.
