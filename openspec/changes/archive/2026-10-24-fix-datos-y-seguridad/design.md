# Design

## Context

See `proposal.md` — Why. Estado que condiciona el enfoque:

- **Producción no se toca a mano**: las migraciones son la fuente de verdad y
  se aplican solas al mergear a `master`
  (`.github/workflows/supabase-migrations.yml`). Cualquier arreglo tiene que
  llegar como migración nueva; las migraciones ya aplicadas no se editan.
- **El baseline y producción ya divergen**: `supabase/migrations/` no crea el
  bucket `receipts` ni dos índices, y las ACL de producción vienen de los
  `GRANT ALL` que el dashboard aplicó por defecto
  (`backups/prod-schema.sql:1027`), no de `grant select … to anon`
  (`20240101000000_init.sql:458`).
- **Patrones de casa para reutilizar**: `invite_lookup_attempts` (RLS sin
  políticas, solo `security definer`) para el rate limit; la migración de
  `avatars` (`20260805120000`) para buckets y políticas de Storage; el
  `drop policy if exists` + DO block de `20261018120000` para idempotencia;
  `runWithOfflineFallback`, `optimistic.ts` y el persister para la capa offline.
- **Migración pendiente**: `20261018120000_wishlist_realtime_hardening.sql` está
  en el repo y no en producción; el próximo `db push` la aplica junto con las
  nuevas (WITH CHECK de wishlist + Realtime), efecto esperado y verificable.

## Goals / Non-Goals

**Goals:**

- Que las reglas de acceso vivan en migraciones y que un entorno recreado desde
  cero se comporte igual que producción (incluida la subida de facturas).
- Que el CI pueda detectar la regresión: el e2e local de facturas debe poder
  subir de verdad (o su tolerancia quedar explícita).
- No perder datos de usuario con ninguna migración.

**Non-Goals:**

- Reglas de propiedad del hogar: hoy cualquier miembro puede borrarlo (está
  documentado como funcionalidad); añadir un "propietario" es un cambio de
  producto aparte.
- Limpiar la columna `expenses.splits` (sin uso) o `supabase/schema.sql`
  (snapshot histórico): tocarlos no aporta seguridad y sí ruido.
- CORS del Edge Function: su protección real es el JWT + el rate limit; el
  origen abierto no da lectura de token a un tercero.
- Rate limit de `create_household`: fuera del alcance de este change.

## Decisions

### 1. Crear hogar: política para `authenticated` + ACL reproducibles

Migración nueva: `drop policy` + `create policy "households: crear hogar" … for
insert to authenticated with check (true)` (el camino previsto sigue siendo el
RPC `create_household`), y alineación de ACL: `revoke all on all tables in
schema public from anon` + `grant select on all tables in schema public to anon`,
`revoke all on all functions in schema public from anon`. Se conserva el `select`
a `anon` porque RLS ya lo filtra a cero filas y quitarlo arriesga el arranque sin
sesión. Alternativa descartada: `with check (false)` para forzar el RPC —
`create_household` es `security definer` y funcionaría, pero rompe cualquier
insert legítimo futuro y hace más difícil razonar el error.

### 2. Unirse: RPC que valida el código + privilegios por columna

- Se extrae el rate limit a `public.consume_invite_lookup_attempt(p_user uuid)`
  (ventana deslizante 10/10 min, `security definer`, `search_path = public`,
  `revoke all … from public` y sin `grant`): lo usan `get_household_by_code`
  (sin cambios de contrato) y el nuevo `join_household_by_code(p_code text)`,
  que valida el código y hace el `update public.profiles` dentro de la misma
  transacción.
- Para que el cliente no pueda mover su `household_id`, en `profiles` se
  `revoke update` a `authenticated` y se `grant update (full_name, avatar_path,
  payday)` (las tres columnas que la app escribe hoy: `useUpdateProfile`,
  `useUpdateAvatar`/`useRemoveAvatar` y `useUpdatePayday`). Dentro del RPC el
  UPDATE corre como dueño, así que no lo afecta.
- `useJoinHousehold` pasa a llamar solo `join_household_by_code`.
- Alternativas descartadas: trigger con bandera `set_config('app.joining',…)`
  (más piezas móviles y una GUC que hay que proteger); mantener el UPDATE
  directo y validar el código en un trigger (no se puede: el código no viaja en
  el UPDATE).

### 3. Bucket de facturas en migración (idempotente)

Se copia el bloque de `supabase/schema.sql:1146-1171` (bucket privado, 8 MB,
jpeg/png/webp; políticas "subir del hogar" y "leer del hogar" con
`foldername(name)[1] = (select household_id::text from profiles where id =
auth.uid())`) en una migración con `insert … on conflict (id) do update` y
`drop policy if exists` antes de cada `create policy`, el mismo patrón de
`20260805120000_add_profile_avatar.sql`. Alternativa descartada: documentar el
bucket como paso manual (es el origen del agujero: local y CI no lo tienen y el
e2e tolera el fallo, `tests/e2e-flow.mjs:486-489`).

### 4. Paridad de esquema: índices y `parsed_data`

- `create index if not exists` para `wishlist_items (household_id)`,
  `expenses (receipt_id)` y `receipts (household_id)` (los dos últimos ya
  existen en producción; se declaran para que un entorno nuevo los tenga).
- `receipts.parsed_data`: `update … set parsed_data = '{}' where parsed_data is
  null`, `set default '{}'`, `set not null`. `src/shared/lib/types.ts:78` ya lo
  declara no nulo, así que no hay cambio de cliente; el caso que hoy se rompe en
  local (`ReceiptViewer` sobre una factura recién subida) queda cubierto.

### 5. Rate limit del análisis de facturas

- Tabla `public.receipt_analysis_attempts (id bigserial pk, profile_id uuid not
  null references auth.users(id) on delete cascade, created_at timestamptz not
  null default now())` + índice `(profile_id, created_at desc)`, RLS habilitada
  y sin políticas (patrón `invite_lookup_attempts`: solo la usa `service_role`,
  que ignora RLS).
- En la Edge Function, **después** de validar JWT y pertenencia al hogar
  (`index.ts:69-80`) y **antes** de descargar la imagen (`:82`): cuenta los
  intentos de las últimas 24 h, borra los de más de 7 días del mismo usuario,
  responde `429` si llegó a 20 e inserta el intento en caso contrario.
- `useReceipts.ts:60-65` hoy tira `error.message` genérico
  ("Edge Function returned a non-2xx status code"): se lee el cuerpo del error
  (`error.context`) para mostrar el mensaje del servidor, y así el 429 dice qué
  pasó. Alternativa descartada: limitar en el cliente (eludible).

### 6. Cierre de sesión: outbox vacío y confirmación

`queue.ts` gana `clearOps()`; `signOut()` en `useAuth` la llama junto a
`queryClient.clear()` y `clearPersistedCache()`. Como eso descarta cambios sin
sincronizar, `Layout.tsx` (que ya tiene `confirmSignOut`) y `Profile.tsx` (que
hoy no confirma nada) leen `useOfflineStatus().pending` y avisan en el
`ConfirmDialog` cuando hay pendientes. Alternativa descartada: descartar en
silencio con un toast (pierde datos sin que el usuario decida).

### 7. Caché optimista tras recargar sin red: proyectar el outbox

El persister solo guarda en IndexedDB las queries que terminaron con éxito
(`createPersister.js:115-121`), así que `setQueryData` de `optimistic.ts` no
sobrevive a una recarga. En vez de depender de las claves internas del
persister, se proyecta el outbox sobre lo que devuelve el persister:

- `queue.ts` mantiene un espejo en memoria (`getCachedOps()`, actualizado en
  `enqueueOp`/`removeOp`/`listOps`).
- `optimistic.ts` expone `projectOpsOnto(queryKey, rows)`: aplica por id los
  `add`/`update`/`delete` pendientes que correspondan a la clave (`expenses` e
  `incomes` por mes, `salaries` por perfil+mes); es idempotente (un `add` con el
  id ya presente reemplaza, no duplica).
- `main.tsx` usa un wrapper `persister: async (queryFn, ctx, query) =>
  projectOpsOnto(query.queryKey, await queryPersister.persisterFn(queryFn, ctx, query))`.
- Al sincronizar, `syncNow()` ya invalida todas las queries (`sync.ts:209-213`),
  así que el servidor vuelve a ser la única fuente.
- Alternativas descartadas: escribir en el almacenamiento del persister
  (API interna: prefijo, serialización y buster podrían cambiar en un patch);
  fusionar el outbox en cada página (filtra la capa offline a la UI).

### 8. Invalidación de claves dependientes

`useCategories` (`useAddCategory`, `useUpdateCategory`, `useDeleteCategory`) y
las mutaciones de presupuesto invalidan además `['expenses']` cuando el cambio
altera lo que muestran los gastos (borrado/renombrado con `set null`) y
`['budgets']` en el borrado, igual que el mapa de `useRealtimeSync.ts:17`.

## Risks / Trade-offs

- [Revocar privilegios a `anon` puede romper una lectura pre-login no
  detectada] → se conserva `select`; verificación del arranque sin sesión
  (`/login`, `/terminos`) y de la suite completa en local antes de la PR.
- [Los privilegios por columna bloquean futuros UPDATE del cliente sobre
  `profiles`] → el error es explícito (42501) y la decisión queda documentada en
  `ARQUITECTURA.md` §5; agregar una columna nueva al cliente exige una línea en
  una migración.
- [El rate limit de 20/24 h molesta en pruebas manuales] → `delete from
  receipt_analysis_attempts` en local resetea; el error 429 lo dice.
- [La proyección del outbox podría duplicar una fila ya sincronizada] → la
  proyección se aplica por id (reemplaza, no anexa) y `syncNow` invalida al
  terminar; el escenario de convergencia queda en el spec y en el e2e.
- [La migración aplica a producción al mergear] → ninguna operación es
  destructiva: el backfill de `parsed_data` solo llena nulos, las políticas se
  sustituyen con `drop … if exists` y los `revoke`/`grant` son reversibles con
  otra migración.
- [La migración pendiente de wishlist se aplica en el mismo push] → es el
  comportamiento esperado (WITH CHECK + Realtime); se anota en la PR para que
  Jhotis12 sepa que ese cambio también entra a producción.

## Migration Plan

Cuatro migraciones nuevas, independientes y revisables por separado:

1. `…_acl_roles_y_households_insert.sql`: `revoke all … from anon` en tablas y
   funciones, `grant select on all tables … to anon`, y la política INSERT de
   `households` solo para `authenticated`.
2. `…_join_household_by_code.sql`: `consume_invite_lookup_attempt`, refactor de
   `get_household_by_code`, `join_household_by_code`, privilegios por columna en
   `profiles` (`revoke update` + `grant update (full_name, avatar_path, payday)`).
3. `…_receipts_bucket_indices_parsed_data.sql`: bucket `receipts` + 2 políticas,
   los 3 índices y `parsed_data not null default '{}'`.
4. `…_receipt_analysis_rate_limit.sql`: tabla de intentos + índice, RLS sin
   políticas.

Cómo probarlas en local (stack levantado con `supabase start`):

```bash
supabase db reset --local          # aplica las 14+ migraciones desde cero
# ACL y política de hogares
docker exec -i supabase_db_App-gastos psql -U postgres -d postgres -c \
  "set role anon; insert into public.households (name, invite_code) values ('x','XXXXXXXXXX');"
#   → ERROR: permission denied for table households
# UPDATE directo de household_id como usuario autenticado (simulando el JWT)
docker exec -i supabase_db_App-gastos psql -U postgres -d postgres <<'SQL'
begin;
select set_config('request.jwt.claims', json_build_object('sub','<uuid-de-perfil>')::text, true);
set local role authenticated;
update public.profiles set household_id = (select id from public.households limit 1) where id = '<uuid-de-perfil>';
--   → ERROR: permission denied for table profiles  (columna household_id)
rollback;
SQL
# Unión con código válido (debe funcionar) y sin código (debe fallar)
docker exec -i supabase_db_App-gastos psql -U postgres -d postgres -c \
  "select public.join_household_by_code('<código válido>');"
# Bucket + RLS de Storage: la subida de facturas del e2e deja de tolerar el fallo
# Rate limit: 21 llamadas seguidas a la función (supabase functions serve) → 429
```

Rollback: revertir la PR antes del merge no aplica nada; después del merge, la
salida es una migración nueva que devuelva los `grant`/políticas anteriores
(los `revoke` no borran datos). `parsed_data` puede volver a `drop not null` sin
pérdida. No hay `drop` de datos en ninguna migración.
