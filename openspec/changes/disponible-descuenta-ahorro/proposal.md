# Proposal: El disponible personal descuenta el ahorro

## Why

El hero de Inicio muestra "Disponible personal · desde tu último pago" sin
restar el dinero que la persona ya movió a sus metas: el número sugiere que ese
ahorro sigue disponible para gastar y el usuario pierde claridad sobre cuánto
le queda realmente. Además, los specs conviven con una contradicción documentada
desde `me-alcanza-hasta-proximo-pago`: `finanzas/gastos-personales` prohíbe
descontar el ahorro del disponible, mientras `finanzas/ahorros` da por hecho que
el ahorro está descontado (archivar, retirar, deshacer, autoahorro).

## What Changes

- **BREAKING (semántica de cifra)**: `get_member_available(p_as_of)` pasa a
  calcular Σ salarios + Σ ingresos extra − Σ gastos pagados − **Σ movimientos
  de ahorro propios (con signo)**, todos dentro de la misma ventana desde el
  último pago hasta `p_as_of`.
- `get_household_available(p_as_of)` aplica la misma resta por miembro: sigue
  siendo la suma de los disponibles personales y nunca suma saldos de metas.
- Solo movimientos con dueño: los aportes de otros miembros no afectan el
  disponible de la persona y las aperturas migradas (`member_id = null`) no
  descuentan a nadie.
- Sin ingresos registrados el disponible sigue siendo `null` (no se inventa);
  el ahorro se sigue mostrando en su propia sección.
- El hero de Inicio se vuelve reconstruible: el subtítulo pasa a "Ingresos −
  gastos − ahorro desde tu último pago" y la tarjeta "Mi ahorro" pasa a la
  ventana "desde tu último pago" (hoy muestra el mes calendario), de modo que
  el disponible resta exactamente lo que esa tarjeta indica.
- Proyección: el "ahorro ya apartado" queda dentro del disponible y se
  actualizan los textos que hoy dicen "No modifica tu disponible personal";
  los aportes de autoahorro pendientes siguen restando como compromisos (sin
  doble conteo). Quiero comprar hereda la nueva cifra sin cambios de código.
- Se actualizan `tests/e2e-money.mjs`, `tests/db/finance-rpcs.sql` y
  `ARQUITECTURA.md` a la nueva semántica.
- Resuelve la contradicción entre specs en favor de "el ahorro descuenta el
  disponible del aportante".

## Supuestos

- La resta usa la **misma ventana del disponible** (desde el último pago), no
  el mes calendario de la tarjeta actual; la tarjeta "Mi ahorro" se alinea a
  esa ventana para que "restar lo que indica Mi ahorro" sea literal y el hero
  no mezcle dos bases (alternativas en `design.md`).
- El cambio se hace en la **definición compartida** (RPC), no solo en el número
  de Inicio: Proyección y Quiero comprar consumen el mismo `available` y
  mostrar cifras distintas entre pantallas reintroduciría la confusión que se
  quiere corregir. El disponible del hogar acompaña por definición (suma de los
  personales).
- Movimientos de ahorro con fecha futura quedan fuera hasta que `p_as_of` los
  alcance, igual que gastos e ingresos.
- El autoahorro ya ejecutado (movimiento existente) queda dentro del
  disponible; el pendiente sigue como compromiso en Proyección.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `finanzas/gastos-personales`: se reemplaza "Disponible personal desde el
  último pago" por "Disponible personal neto de ahorro": descuenta el ahorro
  neto propio de la misma ventana.
- `finanzas/ahorros`: se reemplaza "El ahorro se muestra separado del
  disponible" por "El ahorro descuenta el disponible del aportante" (aportes de
  otros y aperturas migradas no afectan el disponible propio).
- `finanzas/hogar`: "Disponible del hogar en Inicio" aclara que es la suma de
  los personales ya netos de ahorro propio y que no suma saldos de metas.
- `producto/experiencia-v2`: "Inicio con foco personal" ajusta la frase "sin
  incluir el ahorro" a la nueva semántica.

## Impact

- Código: una migración SQL que reemplaza dos RPCs (`get_member_available`,
  `get_household_available`); `src/modules/dashboard/Dashboard.tsx` (subtítulo
  del hero y ventana de la tarjeta "Mi ahorro"); `src/modules/forecast/Forecast.tsx`
  (textos de "ahorro ya apartado"); `tests/e2e-money.mjs`,
  `tests/db/finance-rpcs.sql`, `ARQUITECTURA.md`. Wishlist y `useForecast` no
  cambian de código (heredan el RPC).
- Datos/API: sin cambios de tablas, RLS, triggers ni índices nuevos; las
  claves de invalidación existentes ya refrescan `member-available` tras
  movimientos de ahorro.
- Producto: el número del hero baja para quienes ahorran y puede verse negativo
  si ya gastaron el dinero ahorrado (el estilo negativo ya existe).

## Git y PR

- Rama propuesta: `feat/disponible-descuenta-ahorro` desde `master`,
  idealmente después de mergear la PR de `me-alcanza-hasta-proximo-pago` (este
  change ajusta textos que ese change introduce en Proyección).
- Migraciones: una, creada con `supabase migration new` (reemplazo de las dos
  RPCs), probada en local con `supabase migration up --local` y las pruebas SQL.
- Checks locales: `pnpm build`, `pnpm lint`, `pnpm test`, SQL de finance-rpcs,
  `node tests/e2e-flow.mjs`, `node tests/e2e-money.mjs` y
  `node tests/check-mobile.mjs` (el hero cambia de textos) con Supabase local,
  dev server y sandbox reseteados.
- CI: `CI` (build + lint) y `E2E` (Supabase local + suites) en verde. No se
  mergea con checks en rojo; el merge lo hace Jhotis12.

## Out of Scope

- Cambiar la ventana del disponible o de "Mi mes".
- Alinear `run_due_savings` a la nueva base (su chequeo de "sin saldo" usa base
  histórica; se documenta el desfase en `design.md`).
- Historial personal/hogar: `free` y `accumulated` ya descuentan el ahorro.
- Renombrar "Disponible" como "Libre después del ahorro" o cambiar la
  terminología de `producto/experiencia-v2`.
- Reparto de metas compartidas, proyección multi-mes u hogares con vista propia.
