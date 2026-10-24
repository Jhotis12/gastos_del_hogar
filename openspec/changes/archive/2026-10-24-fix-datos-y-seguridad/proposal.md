# Proposal

## Why

La auditoría del esquema (migraciones, `supabase/schema.sql`, el dump
`backups/prod-schema.sql` y la base local) encontró tres problemas de seguridad
con impacto real y varios desfases entre lo que reproducen las migraciones y lo
que hay en producción:

- **El bucket de facturas no está en migraciones**: el bucket `receipts` y sus
  políticas viven solo en el snapshot y en el dashboard. Un entorno creado
  desde migraciones (`supabase db reset`, CI, disaster recovery) **no puede
  subir ni leer facturas** (verificado en local: insertar en `storage.objects`
  da "new row violates row-level security policy"), y el e2e lo tolera
  (`tests/e2e-flow.mjs:486-489`), así que el CI queda verde con la función rota.
- **Cualquiera con la anon key puede crear hogares**: la política INSERT de
  `households` es `with check (true)` sin restringir rol y en producción `anon`
  conserva los `GRANT ALL` del dashboard (verificado en la base local:
  `set role anon; insert into households … → INSERT 0 1`).
- **Unirse a un hogar no pasa por el código de invitación**:
  `useJoinHousehold` escribe `profiles.household_id` directamente y la política
  solo exige `auth.uid() = id`, así que quien conozca el UUID (por ejemplo un
  ex-miembro) re-entra sin código y el rate limit de `get_household_by_code`
  queda eludible; a partir de ahí cualquier miembro puede borrar el hogar en
  cascada.

Además: `analyze-receipt` no tiene rate limit (cuota de Gemini), la cola offline
no se vacía al cerrar sesión (privacidad en dispositivo compartido y replay bajo
la sesión siguiente), `wishlist_items.household_id` no tiene índice, y las
migraciones no reproducen dos índices ni el `NOT NULL` de `receipts.parsed_data`
que sí existen en producción.

## What Changes

- **Unirse solo con código válido**: nuevo RPC `join_household_by_code(p_code)`
  que valida el código con el rate limit existente (10 intentos/10 min) y
  asigna el hogar server-side; `profiles` pasa a privilegios por columna
  (`full_name`, `avatar_path`, `payday`) para que `household_id` no se pueda
  cambiar con un UPDATE directo. `useJoinHousehold` usa el RPC nuevo.
- **Hogares solo de usuarios autenticados**: la política INSERT de `households`
  se restringe a `authenticated` y una migración alinea las ACL de producción
  con las migraciones (quitar de `anon` INSERT/UPDATE/DELETE y la ejecución de
  funciones, conservando `select`).
- **Facturas reproducibles desde migraciones**: el bucket `receipts` (límites
  8MB, solo imágenes) y sus 4 políticas por hogar se crean/actualizan en
  migración idempotente; los índices `expenses.receipt_id`,
  `receipts.household_id` y `wishlist_items.household_id` se declaran en
  migración; `receipts.parsed_data` recupera `not null default '{}'`.
- **Rate limit en el análisis de facturas**: la Edge Function cuenta los
  análisis por usuario en las últimas 24 horas (tabla de intentos con RLS sin
  políticas, igual que `invite_lookup_attempts`) y responde `429` con mensaje
  claro al superar el límite.
- **Cierre de sesión sin residuos**: `signOut()` vacía el outbox de IndexedDB
  además de la caché de queries; y si hay cambios pendientes, el cierre de
  sesión (sheet "Más" y Perfil) pide confirmación avisando que se descartarán.
- **Caché optimista que sobrevive a una recarga sin red**: los cambios
  encolados se proyectan sobre las lecturas servidas desde IndexedDB, así que
  un gasto guardado sin conexión ya no "desaparece" si el usuario recarga antes
  de sincronizar.
- **Invalidación completa al borrar categorías**: la mutación local invalida
  también `expenses` y `budgets`, como ya hace el mapa de Realtime.

## Capabilities

### New Capabilities

- `security/acceso-a-datos`: quién puede crear un hogar, quién puede entrar a
  uno y con qué prueba, y qué privilegios tiene `anon` sobre las tablas y
  funciones del esquema público.
- `security/abuso-de-api`: límite de uso por usuario en la Edge Function de
  facturas para no quemar la cuota de Gemini.
- `data/paridad-de-esquema`: lo que las migraciones reproducen (bucket de
  Storage, políticas, índices, restricciones) coincide con producción, de modo
  que un entorno nuevo funcione igual y el CI detecte las regresiones.
- `data/coherencia-de-cache`: cada mutación invalida las claves de query que
  dependen de los datos cambiados, no solo la de su dominio.

### Modified Capabilities

- `offline/offline-mode`: se agrega que el cierre de sesión vacía la cola (con
  confirmación si hay pendientes) y que la caché optimista se re-aplica al
  arrancar sin red.

## Impact

- **Migraciones** (nuevas, `supabase/migrations/<timestamp>_*.sql`): ACL de
  `anon` + política INSERT de `households`; función de rate limit compartida +
  `join_household_by_code` + privilegios por columna en `profiles`; bucket
  `receipts` y sus políticas; índices y `parsed_data not null`; tabla de
  intentos del análisis de facturas. La PR también aplica la migración pendiente
  `20261018120000_wishlist_realtime_hardening.sql` (WITH CHECK de wishlist y
  Realtime), que hoy no está en producción.
- **Edge Function**: `supabase/functions/analyze-receipt/index.ts` (rate limit).
- **Frontend**: `src/modules/profile/hooks/useHousehold.ts` (RPC nuevo),
  `src/shared/hooks/useAuth.tsx` (vaciar outbox al salir),
  `src/shared/components/layout/Layout.tsx` y `src/modules/profile/Profile.tsx`
  (confirmación con pendientes), `src/shared/lib/offline/{queue,sync,optimistic,persister}.ts`
  y `src/main.tsx` (proyección del outbox), `src/modules/categories/hooks/useCategories.ts`
  (invalidación), `src/shared/lib/types.ts` si el NOT NULL cambia el tipo.
- **Producción**: al mergear a `master`, `supabase-migrations.yml` aplica las
  migraciones a producción. Ninguna migración borra datos de usuario: el
  `parsed_data` se rellena con `'{}'` antes del `not null`, y las políticas
  nuevas sustituyen a las viejas con `drop policy if exists`.
- **Riesgos**: quitar privilegios a `anon` podría romper alguna consulta
  pre-login (se conserva `select` y se verifica el arranque sin sesión); el
  privilegio por columna en `profiles` obliga a que todo UPDATE del cliente use
  solo esas columnas (se revisan los tres usos actuales); el rate limit del
  análisis puede molestar en pruebas repetidas (se documenta el número y el
  error).
- **No objetivos** (detalle en design.md): reglas de propiedad del hogar
  (hoy cualquier miembro puede borrarlo, comportamiento documentado), la
  columna `expenses.splits` sin uso, editar migraciones ya aplicadas,
  `supabase/schema.sql` como snapshot histórico, CORS del Edge Function, y
  rate limit en los RPC de hogar más allá del existente.

## Git y PR

- **Rama**: `fix/datos-y-seguridad` (desde `master`).
- **Migraciones**: sí. Se crean y prueban en local (`supabase db reset` /
  `supabase migration up --local`) y se verifican con consultas como
  `authenticated` y `anon` (`docker exec` sobre el stack local). A producción se
  aplican SOLO al mergear a `master` (workflow `supabase-migrations.yml`);
  ninguna migración se pega a mano en el dashboard.
- **Checks de CI que deben pasar**: `CI` (build + lint) y `E2E` (Supabase local
  + `e2e-flow`, `e2e-mobile`, `check-mobile`, `e2e-realtime`). En local, antes
  de abrir la PR: `pnpm build`, `pnpm lint`, `supabase db reset --local`,
  `node tests/e2e-flow.mjs` (47 pasos) y las pruebas de RLS documentadas en
  design.md.
- Revisa, aprueba y mergea **Jhotis12**; el agente no mergea.
