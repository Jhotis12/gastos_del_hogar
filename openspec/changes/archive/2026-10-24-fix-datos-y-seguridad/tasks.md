# Tasks

## 1. ACL de roles y creación de hogares

- [ ] 1.1 Crear la migración de ACL y política de hogares (`revoke all … from anon` en tablas y funciones del esquema público, `grant select on all tables … to anon`, política INSERT de `households` solo para `authenticated`) y verificar con `supabase db reset --local` + el insert como `anon` de design.md que falla con "permission denied"
- [ ] 1.2 Verificar con psql que `set role anon; select count(*) from public.expenses;` sigue funcionando (0 filas, sin error de permisos) y que `execute` de una función de negocio como `anon` es rechazado

## 2. Unirse a un hogar con código

- [ ] 2.1 Crear la migración de rate limit compartido (`consume_invite_lookup_attempt` con `search_path` fijo y sin `execute` para `public`/`anon`/`authenticated`, refactor de `get_household_by_code` para usarlo) y verificar en psql que 10 intentos pasan y el 11 responde "Demasiados intentos"
- [ ] 2.2 Crear la migración de `join_household_by_code` y los privilegios por columna en `profiles` (`revoke update` a `authenticated` + `grant update (full_name, avatar_path, payday)`) y verificar con el bloque de design.md que el UPDATE directo de `household_id` da "permission denied" y que el RPC con código válido sí vincula al hogar
- [ ] 2.3 Cambiar `useJoinHousehold` para llamar solo `join_household_by_code` y verificar en local con una segunda cuenta que `/setup` → unirse con el código del hogar sandbox deja ver los datos del hogar (y que un código inventado muestra el error)
- [ ] 2.4 Documentar en `ARQUITECTURA.md` (sección de seguridad; si `fix-consistencia-modulos` ya está mergeado, en §5) que `household_id` solo cambia por RPC y qué columnas de `profiles` puede escribir el cliente, y verificar que la sección existe y nombra `join_household_by_code` y las tres columnas

## 3. Bucket de facturas y paridad de esquema

- [ ] 3.1 Crear la migración del bucket `receipts` (privado, 8 MB, jpeg/png/webp) con las políticas de subida y lectura por hogar, idempotente (`on conflict do update` + `drop policy if exists`), y verificar tras `supabase db reset --local` que insertar en `storage.objects` con el prefijo del propio hogar funciona y con el de otro hogar falla por RLS
- [ ] 3.2 Agregar en la misma migración los índices `wishlist_items (household_id)`, `expenses (receipt_id)` y `receipts (household_id)` más `receipts.parsed_data not null default '{}'` con su backfill, y verificar con `\d receipts` (not null + default), `\di` (los 3 índices) y un insert sin `parsed_data` que la fila queda con `'{}'`
- [ ] 3.3 Verificar que el paso de facturas del e2e local ya no depende del fallo tolerado: con el stack local, subir el fixture `tests/fixtures/factura.jpg` desde la app crea la fila en `receipts` y el archivo en el bucket (el análisis con Gemini sigue requiriendo `supabase functions serve` y se verifica en la tarea 4.2)

## 4. Rate limit del análisis de facturas

- [ ] 4.1 Crear la migración de `receipt_analysis_attempts` (RLS habilitada sin políticas, índice por `profile_id, created_at desc`) y verificar con `select relrowsecurity from pg_class where relname = 'receipt_analysis_attempts'` y `select * from pg_policies where tablename = 'receipt_analysis_attempts'` (sin políticas)
- [ ] 4.2 Agregar a `analyze-receipt` el conteo por usuario (límite 20 en 24 h, limpieza de los intentos de más de 7 días, insert del intento antes de descargar la imagen) y verificar con `supabase functions serve` que 20 llamadas procesan y la 21 responde 429 con el mensaje del límite sin invocar a Gemini
- [ ] 4.3 Hacer que `useReceipts` propague el mensaje del servidor cuando la función responde error (`error.context`) y verificar provocando un 429/403 que el modal muestra el mensaje del servidor y no "Edge Function returned a non-2xx status code"

## 5. Cierre de sesión sin residuos

- [ ] 5.1 Agregar `clearOps()` a `src/shared/lib/offline/queue.ts` y llamarla en `signOut()` (`useAuth.tsx`) junto a `queryClient.clear()` y `clearPersistedCache()`; verificar encolando un gasto sin red, cerrando sesión y viendo en DevTools → Application → IndexedDB que `gastos-offline` queda vacío
- [ ] 5.2 Avisar en el cierre de sesión cuando haya pendientes con `ConfirmDialog` en `Layout.tsx` (extender el mensaje del diálogo existente) y en `Profile.tsx` (diálogo nuevo), leyendo `useOfflineStatus().pending`; verificar que con 2 cambios pendientes ambos cierres muestran el aviso de que se descartarán y que sin pendientes no preguntan de más

## 6. Caché optimista tras recargar sin red

- [ ] 6.1 Mantener el espejo del outbox en `queue.ts` (`getCachedOps`) y agregar `projectOpsOnto(queryKey, rows)` en `optimistic.ts` (por id, idempotente, por mes en expenses/incomes y por perfil+mes en salaries); verificar con `pnpm build` y con la repro manual: crear un gasto sin red, recargar sin red y ver el gasto y el total del mes con el contador de pendientes
- [ ] 6.2 Usar el wrapper del persister en `main.tsx` (`projectOpsOnto` sobre el resultado de `queryPersister.persisterFn`); verificar que con la cola vacía el comportamiento es idéntico (recarga sin red sirve los mismos datos) y que al sincronizar la fila proyectada no se duplica
- [ ] 6.3 Ampliar el paso e2e "registros sin conexión y sincronización al reconectar" con la recarga sin red (dentro del mismo paso, para mantener los 47) y verificar `node tests/e2e-flow.mjs` verde y el conteo de pasos sin cambios

## 7. Invalidación de claves dependientes

- [ ] 7.1 Hacer que `useCategories` (`useAddCategory`, `useUpdateCategory`, `useDeleteCategory`) invalide `['expenses']` cuando el cambio afecta lo que muestran los gastos y `['budgets']` al borrar, y verificar en local borrando una categoría con gastos que la lista de gastos deja de mostrar esa categoría sin recargar

## 8. Verificación de integración

- [ ] 8.1 Con el stack local recreado (`supabase db reset --local`) correr `node tests/e2e-flow.mjs` (47 pasos), `node tests/check-mobile.mjs` y `node tests/e2e-mobile.mjs`, y verificar que no hay errores de permisos (42501) en el flujo normal ni regresiones en los pasos de hogar, salarios y facturas
- [ ] 8.2 Correr `node tests/e2e-realtime.mjs` (sin cambios de realtime salvo la migración pendiente de wishlist) y verificar que sigue verde
- [ ] 8.3 Correr `pnpm build`, `pnpm lint`, `openspec validate fix-datos-y-seguridad --strict` y `supabase db push --dry-run`, y verificar que el dry-run lista SOLO las migraciones nuevas más `20261018120000_wishlist_realtime_hardening.sql`

## 9. Git y PR

- [ ] 9.1 Crear la rama desde master (`git checkout -b fix/datos-y-seguridad`) y verificar con `git branch --show-current` que no se trabaja en `master`
- [ ] 9.2 Hacer commits por área (`feat(db):`, `fix(db):`, `fix(offline):`, `docs:`) y verificar con `git log --oneline master..HEAD` que cada migración va en su commit
- [ ] 9.3 Subir la rama con `git push -u origin fix/datos-y-seguridad` y verificar que la rama remota existe
- [ ] 9.4 Abrir la PR con `gh pr create --base master --fill` (si `gh` no está autenticado, pasar la URL de compare al usuario) explicando que el merge aplica las migraciones a producción, incluida la pendiente de wishlist
- [ ] 9.5 Verificar `CI` y `E2E` en verde (`gh pr checks`); si algún test no se pudo correr en local (p. ej. el análisis real con Gemini), dejarlo dicho explícitamente en la PR

## Workflow follow-up

- Jhotis12 revisa, aprueba y mergea la PR; el agente no mergea.
- Tras el merge: verificar en GitHub Actions que `supabase-migrations.yml` aplicó las migraciones a producción sin error.
- Después: archivar el change en una rama nueva (`chore/archive-fix-datos-y-seguridad`) desde master, con `openspec archive fix-datos-y-seguridad` y PR con `gh`.
