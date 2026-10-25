## Purpose

Permite registrar gastos, dinero extra y salarios sin conexión y sincronizarlos al reconectar sin perder datos ni mostrar estados de autenticación incorrectos.

## Requirements

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

Solo `expenses`, `incomes` y `salaries` SHALL ser operables offline
(crear/editar/eliminar). Facturas, metas, presupuestos, categorías, servicios y
la lista de deseos (`wishlist_items`) requieren red: sus mutaciones SHALL fallar
de inmediato con un mensaje claro para el usuario ("Sin conexión: vuelve a
intentarlo cuando estés en línea") y SHALL NOT encolarse. Ante conflicto
multi-dispositivo SHALL aplicar último en escribir gana (last-write-wins), sin
merge.

#### Scenario: Editar gasto offline y online concurrente

- **WHEN** dos dispositivos editan el mismo gasto offline y ambos sincronizan
- **THEN** el último `update` en llegar al servidor prevalece; no se muestra error de conflicto

#### Scenario: Acción de wishlist sin red

- **WHEN** el usuario crea un deseo, lo edita o cambia su estado sin conexión
- **THEN** no se encola ninguna operación, se muestra el mensaje de sin conexión y no queda una promesa rechazada sin manejar

### Requirement: Aviso offline sin duplicar

Cuando una mutación de `expenses`, `incomes` o `salaries` se resuelve por la
vía offline (encolada en el outbox), el sistema SHALL mostrar únicamente el
aviso "Guardado sin conexión" emitido por la capa offline; la página SHALL NOT
mostrar además su propia confirmación de éxito.

#### Scenario: Gasto creado sin red

- **WHEN** el usuario registra un gasto sin conexión desde Gastos o Dashboard
- **THEN** aparece "Guardado sin conexión" y NO aparece además "Gasto registrado"

#### Scenario: Dinero extra creado sin red

- **WHEN** el usuario registra dinero extra sin conexión
- **THEN** aparece "Guardado sin conexión" y NO aparece además "Dinero extra registrado"

### Requirement: Gastos offline con pagador obligatorio

Los gastos encolados offline SHALL incluir un `paid_by` válido del hogar. La
actualización optimista SHALL conservar el pagador y resolver su nombre desde la
caché de miembros; SHALL NOT mostrar el gasto como `Sin asignar`. El replay
SHALL rechazar un gasto con pagador nulo o de otro hogar y SHALL avisar al
usuario para que lo corrija.

#### Scenario: Gasto offline con pagador

- **WHEN** el usuario registra un gasto sin red y elige a un miembro como pagador
- **THEN** la fila optimista aparece con el pagador y su nombre, y el total personal del pagador se actualiza en la caché

#### Scenario: Replay con pagador válido

- **WHEN** el gasto encolado se sincroniza con un `paid_by` del mismo hogar
- **THEN** se inserta una sola vez y los totales personal y del hogar convergen con el servidor

#### Scenario: Replay con pagador inválido

- **WHEN** un gasto encolado por una versión anterior tiene `paid_by = null`
- **THEN** el replay no lo inserta, lo marca como error y muestra un aviso para asignarle un pagador

#### Scenario: Nombre del pagador no disponible en caché

- **WHEN** el pagador no está en la caché de miembros
- **THEN** la fila optimista muestra un nombre genérico o “Miembro” y no se rompe el render

### Requirement: Ahorro y autoahorro al reconectar

Las mutaciones de ahorro SHALL seguir requiriendo red y SHALL NOT encolarse. El
autoahorro SHALL ejecutarse al recuperar la conexión y SHALL ser idempotente:
un plan no SHALL generar dos movimientos para el mismo mes. Un fallo de
autoahorro SHALL NOT bloquear el resto de la sincronización.

#### Scenario: Depósito sin red

- **WHEN** el usuario intenta depositar en una meta sin conexión
- **THEN** la app muestra el aviso de que el ahorro requiere red y no encola la operación

#### Scenario: Autoahorro al reconectar

- **WHEN** el usuario vuelve a estar online con un plan de autoahorro vencido
- **THEN** se ejecuta el plan, se crea el movimiento una sola vez y se actualizan los saldos

#### Scenario: Fallo de autoahorro no bloquea la cola

- **WHEN** el autoahorro falla por cuota o validación
- **THEN** la cola de gastos se drena igual y el error de ahorro se informa por separado

### Requirement: Invalidación de disponible, historiales y ahorro

Las mutaciones de gastos, ingresos, salarios y ahorro SHALL invalidar las
claves de disponible personal, historiales, ahorro y movimientos, además de las
claves existentes de gastos e ingresos. Los totales de mes/ciclo/hogar se
derivan de las filas de gastos, así que la invalidación de `expenses` es la que
los refresca. Sin red, la invalidación SHALL omitirse y la UI SHALL sostenerse
con la caché optimista.

#### Scenario: Gasto online

- **WHEN** se guarda un gasto con red
- **THEN** se invalidan `expenses`, `member-available`, `personal-history` y `household-history` según corresponda

#### Scenario: Ahorro online

- **WHEN** se registra un depósito o retiro con red
- **THEN** se invalidan `savings`, `savings-movements`, `member-available`, `personal-history` y `household-history`

#### Scenario: Sin red

- **WHEN** se guarda un gasto offline
- **THEN** no se disparan invalidaciones y la caché optimista mantiene los totales de las filas coherentes hasta el sync
