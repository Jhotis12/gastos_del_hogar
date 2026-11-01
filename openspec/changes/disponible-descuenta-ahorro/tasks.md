# Tasks

## 1. Migración y RPCs

- [x] 1.1 Crear la migración con `supabase migration new descuenta_ahorro_en_disponible` y reemplazar `get_member_available`: sumar los `savings_movements` propios (con signo) con `movement_date` entre `member_cycle_start` y `p_as_of`, y restarlos del `available`; conservar `security definer`, `set search_path = public`, `stable` y los revoke/grant existentes. Verificar con `supabase migration up --local` y una llamada al RPC por psql (`docker exec`) tras un depósito propio: el disponible baja exactamente el monto depositado y sigue `null` sin ingresos.
- [x] 1.2 Extender `get_household_available` con la misma suma y resta dentro del loop por miembro. Verificar por psql con dos miembros: el disponible del hogar baja por el aporte propio de cada uno y no por los aportes del otro, y nunca suma saldos de metas.
- [x] 1.3 Verificar el plan de la nueva suma con `EXPLAIN` en psql local (`member_id + movement_date` sobre `savings_movements`) y anotar el resultado en la PR; un seq scan es aceptable (tabla por hogar, mismo patrón que `get_personal_monthly_history`). Verificar que el RPC no se degrade de forma visible en la respuesta.

## 2. Inicio (hero)

- [x] 2.1 En `src/modules/dashboard/Dashboard.tsx`: subtítulo del disponible a "Ingresos − gastos − ahorro desde tu último pago" y tarjeta "Mi ahorro" filtrando por `financeWindows.cycle` (hoy `month`) con la etiqueta de la ventana vía `rangeLabel`. Verificar en local: tras un depósito, el hero baja exactamente lo que la tarjeta "Mi ahorro" muestra.
- [x] 2.2 Revisar los estados del hero sin cambiar lógica: "Sin base de ingresos" cuando `available` es null y monto en coral cuando es negativo. Verificar a mano en local con un usuario sin ingresos y con un disponible negativo tras ahorrar.

## 3. Proyección

- [x] 3.1 Actualizar en `src/modules/forecast/Forecast.tsx` los textos "No modifica tu disponible personal; se muestra aparte." y "El ahorro ya apartado no se descuenta del disponible." para explicar que ya está descontado del disponible (textos presentes tras el merge de `me-alcanza-hasta-proximo-pago`; este change se ramifica desde master ya con ese merge). Verificar en `/proyeccion` local: el desglose sigue sumando y el autoahorro pendiente no se descuenta dos veces.

## 4. Pruebas

- [x] 4.1 Actualizar `tests/db/finance-rpcs.sql` con los esperados nuevos (A = 1.950.000; hogar = 3.050.000; recalcular los casos posteriores de C y `run_due_savings` con la misma regla). Verificar: `docker exec -i supabase_db_App-gastos psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/db/finance-rpcs.sql` termina con todos los PASS.
- [x] 4.2 Actualizar `tests/e2e-money.mjs`: renombrar los pasos a "el ahorro manual descuenta el disponible" y "autoahorro descuenta el disponible y no duplica", esperando 2.200.000 tras el depósito de 100.000 y 2.150.000 tras el autoahorro de 50.000 (el hero inicial sigue en 2.300.000). Verificar: `node tests/e2e-money.mjs` en verde con Supabase local, dev server y sandbox reseteados.
- [x] 4.3 Correr `node tests/e2e-flow.mjs` y ajustar solo las aserciones afectadas por los textos nuevos (p. ej. el paso de Proyección si valida "ahorro ya apartado"). Verificar la suite en verde.
- [x] 4.4 Correr `node tests/check-mobile.mjs` (el hero cambia de textos a 375/320px) y `pnpm test` (unitarias sin cambios esperados). Verificar ambos en verde.

## 5. Docs

- [x] 5.1 Actualizar `ARQUITECTURA.md` §4: disponible personal y del hogar ahora descuentan el ahorro neto propio de la ventana desde el último pago; apuntar la tarjeta "Mi ahorro" del hero y el cambio de textos de Proyección. Verificar el diff y que la descripción coincide con la fórmula de la migración.

## 6. Git y PR

- [x] 6.1 Crear la rama `feat/disponible-descuenta-ahorro` desde `master` (idealmente después del merge de `me-alcanza-hasta-proximo-pago`); verificar con `git branch --show-current`.
- [x] 6.2 Hacer commits por bloques con la convención del repo (migración / frontend / tests / docs); verificar con `git log --oneline`.
- [x] 6.3 Validación local completa con Supabase local y sandbox reseteados: `pnpm build`, `pnpm lint`, `pnpm test`, SQL de finance-rpcs, `node tests/e2e-flow.mjs`, `node tests/e2e-money.mjs` y `node tests/check-mobile.mjs`; verificar todo en verde y declarar en la PR lo que no se pudo correr.
- [ ] 6.4 Hacer push de la rama y abrir la PR: `git push -u origin feat/disponible-descuenta-ahorro` y `gh pr create --base master --fill`; verificar la URL y que la PR tiene los checks `CI` y `E2E`.
- [ ] 6.5 Si CI falla, corregir y volver a pushear; verificar que `CI` (build + lint) y `E2E` (Supabase local + suites) quedan en verde.

## Workflow follow-up

- La PR la revisa, aprueba y mergea Jhotis12; el agente no mergea.
- Archivar `me-alcanza-hasta-proximo-pago` antes que este change; al archivar este, verificar que el escenario "Ahorro ya apartado" de `finanzas/gastos-personales` quedó ajustado a la nueva semántica.
- Archive posterior en rama nueva `chore/archive-disponible-descuenta-ahorro` desde `master` + PR con `openspec archive disponible-descuenta-ahorro`.
- La migración a producción la aplica `supabase-migrations.yml` al mergear a `master`; nunca SQL a mano.
