## Purpose

Permite registrar gastos, dinero extra y salarios sin conexión y sincronizarlos al reconectar sin perder datos ni mostrar estados de autenticación incorrectos.

## ADDED Requirements

### Requirement: Mutaciones offline con fallback optimista
El sistema SHALL envolver las mutaciones de `expenses`, `incomes` y `salaries` en `runWithOfflineFallback(run, onOffline)`. Si `run()` falla con `isNetworkError`, SHALL ejecutar `onOffline` (encolar en IndexedDB + actualización optimista de caché + toast "Guardado sin conexión") y resolver la mutación como éxito sin mostrar error.

#### Scenario: Crear gasto sin red encola y muestra optimista
- **WHEN** el usuario crea un gasto con `expense_date=2026-09-12` sin red
- **THEN** `enqueueExpenseAdd` genera `id=crypto.randomUUID()`, hace `enqueueOp({entity:'expenses', op:'add', payload:{id, household_id, ...}})`, actualiza `queryData ['expenses', householdId, '2026-09-01']` insertando la fila al inicio, emite toast "Guardado sin conexión" y no muestra error ni login

#### Scenario: Crear gasto con red no usa outbox
- **WHEN** hay red y `supabase.from('expenses').insert` tiene éxito
- **THEN** no se encola nada y `onSuccess` ejecuta `invalidateIfOnline` para `['expenses'], ['running-balance'], ['monthly-surpluses']`

#### Scenario: Error real de validación no se encola
- **WHEN** `supabase.from('expenses').insert` falla con error no de red (RLS `42501`, check `amount>0`)
- **THEN** `runWithOfflineFallback` relanza el error, la mutación muestra `toast.error` y no se guarda en la cola

### Requirement: Detección y rechazo inmediato sin red
El cliente Supabase SHALL usar `offlineAwareFetch` que, si `!navigator.onLine`, rechaza inmediatamente con `TypeError("Network request failed")` sin intentar la petición, evitando ruido CORS y backoff de reintentos de `postgrest`/`auth`.

#### Scenario: Fetch rechazado al instante sin red
- **WHEN** `navigator.onLine===false` y cualquier query/mutación intenta `fetch` a Supabase
- **THEN** `offlineAwareFetch` retorna `Promise.reject(TypeError("Network request failed"))` y `isNetworkError` lo clasifica como offline

### Requirement: Invalidaciones solo con red
`invalidateIfOnline(queryClient, keys)` SHALL no invalidar queries cuando `!navigator.onLine`. La actualización de UI en ese caso depende solo de la caché optimista; el refetch real ocurre tras `syncNow()` al reconectar.

#### Scenario: Mutación offline no invalida
- **WHEN** `useAddExpense.onSuccess` se ejecuta tras `enqueueExpenseAdd` sin red
- **THEN** no se llama `queryClient.invalidateQueries` y no se dispara `QueryError` ni refetch bloqueado

### Requirement: Cola FIFO persistida y replay idempotente
El sistema SHALL persistir operaciones pendientes en IndexedDB (`DB 'gastos-offline'`, store `queue` con `key` autoincremental) y drenarlas en orden FIFO al reconectar. El replay SHALL ser idempotente: `insert` con `23505` (duplicate PK) y `update` con `PGRST116` (0 filas) se tratan como `ok`; solo `isNetworkError` retorna `retry` y detiene el drenado.

#### Scenario: Replay idempotente descarta duplicados
- **WHEN** la cola contiene `expenses.add` con `id` ya existente en el servidor y `syncNow` lo reintenta
- **THEN** `replay` detecta `code=23505` y retorna `ok`, hace `removeOp(key)` y continúa con el siguiente, emitiendo "Cambio sincronizado" al final

#### Scenario: Drenado se detiene ante fallo de red
- **WHEN** `replay` falla con `isNetworkError`
- **THEN** retorna `retry`, `syncNow` hace `break` sin borrar el ítem, y el heartbeat de 15s reintentará

### Requirement: Sincronización al reconectar con feedback
Al evento `online` o al recuperar `navigator.onLine`, el sistema SHALL ejecutar `handleOnline()` que hace `getSession()` (restaura sesión en memoria si venía de boot offline), emite toast "De vuelta en línea" y drena la cola con `syncNow()`. Tras `synced>0` SHALL emitir "N cambios sincronizados" y hacer `queryClient.invalidateQueries()` para traer datos frescos. `OfflineBanner` SHALL mostrar antena wifi + badge con `pending` y spinner `syncing`.

#### Scenario: Reconectar sincroniza y notifica
- **WHEN** el usuario estaba offline con 2 ops encoladas y recupera red
- **THEN** `handleOnline` emite "De vuelta en línea", `syncNow` procesa 2 ops en orden, emite "2 cambios sincronizados", actualiza `pending=0` y refresca todas las queries

#### Scenario: Heartbeat reintenta pendientes cada 15s
- **WHEN** `status.pending>0` y `navigator.onLine===true` sin evento `online` explícito
- **THEN** `setInterval(15000)` invoca `syncNow()` si no está `draining`

### Requirement: Queries offline sirven caché persistida
Las queries de lectura SHALL usar `networkMode: offlineFirst` y `persister: queryPersister` (IndexedDB `gastos-query-cache`, `maxAge 30d`, `refetchOnRestore: always`). Sin red SHALL servir la caché y pausarse sin error; al reconectar SHALL reintentar automáticamente. Mutaciones SHALL usar `networkMode: always` para que `mutationFn` se ejecute y `runWithOfflineFallback` pueda encolar.

#### Scenario: Recarga sin red muestra últimos datos
- **WHEN** el usuario recarga la página sin red y existe caché de `['expenses', householdId, month]`
- **THEN** `useExpenses(month)` retorna datos cacheados sin `error`, `Dashboard` y `Expenses` renderizan sin `QueryError`

#### Scenario: Sin caché y sin red muestra OfflineGate
- **WHEN** no hay caché para `profile` y no hay red tras 3s
- **THEN** `OfflineWait` muestra `<OfflineGate>` en lugar de `PageSkeleton` infinito

### Requirement: Realtime se desconecta sin red y resuscribe al volver
`useRealtimeSync(householdId)` SHALL desconectar `supabase.realtime` y remover el canal al evento `offline`, y recrear el canal `household-${householdId}` al evento `online`, evitando ráfagas de reconexión fallidas.

#### Scenario: Realtime no intenta reconectar sin red
- **WHEN** `navigator.onLine===false`
- **THEN** `offlineRef=true`, `supabase.realtime.disconnect()` y `removeChannel(channel)`; al volver `online` se crea nuevo canal y `subscribe()`

### Requirement: Alcance offline y conflictos
Solo `expenses`, `incomes` y `salaries` SHALL ser operables offline (crear/editar/eliminar). Fotos de facturas, metas, presupuestos, categorías y servicios requieren red. Ante conflicto multi-dispositivo SHALL aplicar último en escribir gana (last-write-wins), sin merge.

#### Scenario: Editar gasto offline y online concurrente
- **WHEN** dos dispositivos editan el mismo gasto offline y ambos sincronizan
- **THEN** el último `update` en llegar al servidor prevalece; no se muestra error de conflicto
