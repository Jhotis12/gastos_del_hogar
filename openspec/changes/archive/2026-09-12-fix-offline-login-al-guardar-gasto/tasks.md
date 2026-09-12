## 1. Centralizar detección de errores de red

- [x] 1.1 Extraer `isNetworkError` a `src/shared/lib/offline/isNetworkError.ts` (puro, sin `navigator` hardcodeado) y verificar que `pnpm build` typecheck pasa sin ciclos
- [x] 1.2 Unificar `isNetworkError` + `isAuthRetryableFetchError` en `useAuth.tsx`, `supabase.ts` y `offline/sync.ts` y verificar que no queda chequeo aislado de `!navigator.onLine` como única verdad

## 2. Blindar AuthProvider ante eventos nulos

- [x] 2.1 Refactorizar `onAuthStateChange(null)` para restaurar `fallback = sessionRef.current ?? readStoredSession()` ante `isNetworkError`/`AuthRetryableFetchError` aunque `navigator.onLine===true`, re-persistir siempre y verificar que `signOutRef` explícito sigue cerrando sesión
- [x] 2.2 Ajustar `bootSession()` (race 2.5s) y `profile` query (`getUser` con `catch` + `isAuthRetryableFetchError`) para no hacer `signOut` en fallos retryable y verificar que `profileLoaded`/`OfflineWait` sirven caché sin redirigir a `/login`
- [x] 2.3 Añadir `console.debug` solo en `DEV` al restaurar fallback (sin PII) y verificar que en `production` no hay logs

## 3. Endurecer capa offline (fetch / cola / sync)

- [x] 3.1 Mantener `offlineAwareFetch` como fast-path `!navigator.onLine` pero asegurar que callers clasifiquen con `isNetworkError` y verificar que `runWithOfflineFallback` encola `expenses/incomes/salaries` y no encola errores RLS/validación
- [x] 3.2 Hacer `syncNow()` tolerante a `getSession()` con error de red (retry vs break definitivo), preservar flag `draining` y verificar en `handleOnline` que `getSession().catch` + `syncNow` restauran sesión antes de drenar
- [x] 3.3 Verificar `invalidateIfOnline` no dispara `invalidateQueries` sin red y que `useRealtimeSync` hace `disconnect`/`removeChannel` en offline y resuscribe en online sin tormenta de reconexiones

## 4. Guards y UX offline

- [x] 4.1 Verificar que `RequireAuth`/`RequireHousehold`/`RequireSetup` con `loading`/`profileLoaded` + `OfflineWait` (3s → `OfflineGate`) no navegan a `/login` cuando `user` está restaurado offline
- [x] 4.2 Verificar `OfflineBanner` muestra badge `pending` y spinner `syncing`, y que toasts son "Guardado sin conexión" / "De vuelta en línea" / "N cambios sincronizados" sin duplicados

## 5. Verificación y regresión

- [ ] 5.1 Repro manual: `DevTools > Network > Offline`, crear gasto → aparece optimista, permanece en `/gastos` (no `/login`), badge pending incrementa; volver Online → "De vuelta en línea" + "1 cambio sincronizado" y persiste tras recarga
- [ ] 5.2 Repro intermitente: `navigator.onLine=true` + `fetch` fallando (throttle offline / portal cautivo simulado con `offlineAwareFetch` mock) → mismo comportamiento: no logout, encola, sincroniza al reconectar
- [x] 5.3 Ejecutar `pnpm build` y `pnpm lint` sin errores y `node tests/e2e-flow.mjs` (incluye paso "registros sin conexión y sincronización al reconectar") en local y en preview, verificando que no hay redirección a `/login` y que no se introducen `console.error` CORS
- [ ] 5.4 Probar `signOut` explícito y sesión revocada (token inválido con red) → sí debe ir a `/login` y limpiar `gastos-query-cache` + cola, verificando que no se "resucita" sesión revocada más allá del próximo `getUser`
